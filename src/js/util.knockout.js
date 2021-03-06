/*
Copyright (c) 2016-Present Energyparty and Energywallet Developers
Distributed under the AGPL 3.0 with the OpenSSL exception, see the
accompanying file LICENSE or https://github.com/energyparty/energywallet
*/

var isBound = function(id) {
  return !!ko.dataFor(document.getElementById(id));
};

ko.subscribable.fn.trimmed = function() {
    return ko.computed({
        read: function() {
            return typeof this() == "string" ? this().trim() : this();
        },
        write: function(value) {
            this(typeof value == "string" ? value.trim() : value);
            if(typeof value == "string") this.valueHasMutated();
        },
        owner: this
    });
};

//http://stackoverflow.com/a/18184016
ko.subscribable.fn.subscribeChanged = function (callback) {
    var savedValue = this.peek();
    return this.subscribe(function (latestValue) {
        var oldValue = savedValue;
        savedValue = latestValue;
        callback(latestValue, oldValue);
    });
};

/* Knockout bindings */
ko.bindingHandlers.showModal = {
  init: function (element, valueAccessor) {
  },
  update: function (element, valueAccessor) {
    var value = valueAccessor();
    if (ko.utils.unwrapObservable(value)) {
      $(element).modal('show');
      $("input", element).focus();
    }
    else {
      $(element).modal('hide');
    }
  }
};

ko.bindingHandlers.timeago = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = valueAccessor();
        var valueUnwrapped = ko.unwrap(value);
        element.title = moment(valueUnwrapped).toISOString();
        $(element).timeago();
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = valueAccessor();
        var valueUnwrapped = ko.unwrap(value);
        element.title = moment(valueUnwrapped).toISOString();
        $(element).timeago('update', element.title);
    }
}

ko.bindingHandlers.datetimepicker = {
  init: function(element, valueAccessor, allBindingsAccessor) {
    //initialize datepicker with some optional options
    var options = allBindingsAccessor().datepickerOptions || {};
    $(element).datetimepicker(options);

    //when a user changes the date, update the view model
    ko.utils.registerEventHandler(element, "change.dp", function(event) {
       var value = valueAccessor();
       if (ko.isObservable(value) && event.date) {
         value(event.date.toDate());
       }                
    });
  },
  update: function(element, valueAccessor)   {
    var widget = $(element).data("DateTimePicker");
     //when the view model is updated, update the widget
    if (widget) {
      var date = ko.utils.unwrapObservable(valueAccessor());
      if (date) {
          widget.setDate(date);
      }
    }
  }
};

  
/* 
 * Shared knockout Validation custom rules
 */
function createSharedKnockoutValidators() {

  ko.validation.rules['isValidBitcoinAddress'] = {
      validator: function (val, self) {
          return CWBitcore.isValidAddress(val);
      },
      message: USE_TESTNET ? i18n.t('must_be_valid_testnet_address') : i18n.t('must_be_valid_bitcoin_address')
  };

  ko.validation.rules['isValidBitcoinAddressIfSpecified'] = {
      validator: function (val, self) {
          try {
            if(!val) return true; //the "if specified" part of the name :)
            return CWBitcore.isValidAddress(val);
          } catch (err) {
            return false;
          }
      },
      message: USE_TESTNET ? i18n.t('must_be_valid_testnet_address') : i18n.t('must_be_valid_bitcoin_address')
  };

  ko.validation.rules['isValidQtyForDivisibility'] = {
      validator: function (val, self) {
        if(!self.divisible() && numberHasDecimalPlace(parseFloat(val))) {
          return false;
        }
        return true;
      },
      message: i18n.t('must_be_whole_number')
  };

  ko.validation.rules['isNotSameBitcoinAddress'] = {
      validator: function (val, self) {
        return val != self.address();
      },
      message: i18n.t('destination_equal_to_source')
  };

  ko.validation.rules['isValidPositiveQuantity'] = {
      validator: function (val, self) {

        return val.toString().match(/^[0-9]*\.?[0-9]{0,6}$/) && parseFloat(val) > 0;
      },
      message: i18n.t('must_be_quantity')
  };

  ko.validation.rules['isValidPositiveQuantityOrZero'] = {
      validator: function (val, self) {
        return val.toString().match(/^[0-9]*\.?[0-9]{0,6}$/) && parseFloat(val) >= 0;
      },
      message: i18n.t('must_be_quantity_or_zero')
  };

  ko.validation.rules['isValidPositiveInteger'] = {
      validator: function (val, self) {
        return val.toString().match(/^[0-9]+$/) && parseFloat(val) >= 0;
      },
      message: i18n.t('must_be_positive_integer')
  };

  ko.validation.rules['isValidUrl'] = {
      validator: function (val, self) {
          return isValidURL(val);
      },
      message: i18n.t('must_be_url')
  };

  ko.validation.rules['isValidUrlOrValidBitcoinAdressOrJsonBet'] = {
      validator: function (val, self) {
        if (!val) return false;
        if (val.length>50 || val.lastIndexOf('=') == val.length-1) {
          return typeof(decodeJsonBet(val)) == 'object';
        } else if (val.indexOf('http://') == 0 || val.indexOf('https://') == 0) {
          return isValidURL(val);
        } else {
          return CWBitcore.isValidAddress(val);
        }   
      },
      message: i18n.t('must_be_url_or_address')
  };

  ko.validation.rules['canGetAddressPubKey'] = {
    async: true,
    message: i18n.t('cant_find_public_key'),
    validator: function (val, self, callback) {
      if(self.addressType() != 'armory') return true; //only necessary for armory offline addresses
      failoverAPI("get_pubkey_for_address", {'address': val},
        function(data, endpoint) {
          self.armoryPubKey(data);
          return data ? callback(true) : callback(false)
        }
      );   
    }
  };

  ko.validation.registerExtenders();

}

//Bootstrap 3 button toggle group handler: http://stackoverflow.com/a/20080917 (with FIX)
ko.bindingHandlers.btnGroupChecked = {
  init: function (element, valueAccessor, allBindingsAccessor,
  viewModel, bindingContext) {
    var value = valueAccessor();
    var newValueAccessor = function () {
        return {
            change: function () {
              if($(element).is(":disabled")) return;
              value(element.value);
            }
        }
    };
    ko.bindingHandlers.event.init(element, newValueAccessor,
    allBindingsAccessor, viewModel, bindingContext);
  },
  update: function (element, valueAccessor, allBindingsAccessor,
  viewModel, bindingContext) {
    if ($(element).val() == ko.unwrap(valueAccessor()) && !$(element).is(":disabled") ) {
      $(element).addClass('active');
    } else {
      $(element).removeClass('active');
    }
  }
}

ko.bindingHandlers.select2 = {
  //From https://github.com/ivaynberg/select2/wiki/Knockout.js-Integration
  init: function(element, valueAccessor, allBindingsAccessor) {
      var obj = valueAccessor(),
          allBindings = allBindingsAccessor(),
          lookupKey = allBindings.lookupKey;
      
      //modify to work with knockout-secure-bindings
      if(obj.hasOwnProperty('escapeMarkup') && obj['escapeMarkup'] === 'direct') {
        obj['escapeMarkup'] = function(m) { return m; };
      }
          
      $(element).select2(obj);
      if (lookupKey) {
          var value = ko.utils.unwrapObservable(allBindings.value);
          $(element).select2('data', ko.utils.arrayFirst(obj.data.results, function(item) {
              return item[lookupKey] === value;
          }));
      }

      ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
          $(element).select2('destroy');
      });
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
    $(element).trigger('change');
  }
};

ko.bindingHandlers.sparkline = {
  update: function (element, valueAccessor, allBindingsAccessor, viewModel)
  {
    var value = ko.utils.unwrapObservable(valueAccessor());
    var options = allBindingsAccessor().sparklineOptions || {};
    $(element).sparkline(value, options);
  }
};

ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
    }
};

ko.bindingHandlers.fadeVisibleInOnly = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).fadeIn() : $(element).hide();
    }
};

ko.bindingHandlers.fadeInText = {
    'update': function(element, valueAccessor) {
        $(element).hide();
        ko.bindingHandlers.text.update(element, valueAccessor);
        $(element).fadeIn('slow');
    }
};

ko.extenders.uppercase = function(target, option) {
    target.subscribe(function(newValue) {
       target(newValue.toUpperCase());
    });
    return target;
};