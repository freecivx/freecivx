/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

// Rates Manager - encapsulates all rate-related state and behavior
const RatesManager = (function() {
  // Private state
  var state = {
    tax: 0,
    luxury: 0,
    science: 0,
    maxrate: 80,
    freeze: false
  };

  // Rate types for array indexing
  var RATE_TAX = 0;
  var RATE_LUXURY = 1;
  var RATE_SCIENCE = 2;

  return {
    getTax: function() { return state.tax; },
    getLuxury: function() { return state.luxury; },
    getScience: function() { return state.science; },
    getMaxRate: function() { return state.maxrate; },
    setMaxRate: function(rate) { state.maxrate = rate; },
    setTax: function(value) { state.tax = value; },
    setLuxury: function(value) { state.luxury = value; },
    setScience: function(value) { state.science = value; },
    isLocked: function(rateType) {
      return $('input[name="lock"]').eq(rateType).is(':checked');
    },
    freeze: function() { state.freeze = true; },
    unfreeze: function() { state.freeze = false; },
    isFrozen: function() { return state.freeze; }
  };
})();

// Legacy global variables for backward compatibility - using var for function hoisting
// These are synced whenever rates change via update_rates_labels()
var tax = 0, sci = 0, lux = 0, maxrate = 80, freeze = false;



/**************************************************************************
  Updates the tax rates tab content inline
**************************************************************************/
function update_taxrates_tab_content()
{
  if (client_is_observer()) return;

  const dhtml = `
    <div class='rates-container'>
      <h2>Select tax, luxury and science rates</h2>
      <form name='rates'>
        <div class='rate-row'>
          <label class='rate-label' for='slider-tax-jquery'>Tax:</label>
          <div class='rate-slider-wrapper'>
            <div class='slider-jquery' id='slider-tax-jquery' role='slider' 
                 aria-label='Tax rate' aria-valuemin='0' aria-valuemax='100'></div>
          </div>
          <div class='rate-value' id='tax_result' aria-live='polite'></div>
          <label class='rate-lock'>
            <input type='checkbox' name='lock' aria-label='Lock tax rate'> Lock
          </label>
        </div>
        <div class='rate-row'>
          <label class='rate-label' for='slider-lux-jquery'>Luxury:</label>
          <div class='rate-slider-wrapper'>
            <div class='slider-jquery' id='slider-lux-jquery' role='slider'
                 aria-label='Luxury rate' aria-valuemin='0' aria-valuemax='100'></div>
          </div>
          <div class='rate-value' id='lux_result' aria-live='polite'></div>
          <label class='rate-lock'>
            <input type='checkbox' name='lock' aria-label='Lock luxury rate'> Lock
          </label>
        </div>
        <div class='rate-row'>
          <label class='rate-label' for='slider-sci-jquery'>Science:</label>
          <div class='rate-slider-wrapper'>
            <div class='slider-jquery' id='slider-sci-jquery' role='slider'
                 aria-label='Science rate' aria-valuemin='0' aria-valuemax='100'></div>
          </div>
          <div class='rate-value' id='sci_result' aria-live='polite'></div>
          <label class='rate-lock'>
            <input type='checkbox' name='lock' aria-label='Lock science rate'> Lock
          </label>
        </div>
      </form>
      <div id='max_tax_rate' class='rate-info'></div>
      <div class='rate-stats' aria-live='polite'>
        Net income: <span id='income_info'></span><br>
        Research: <span id='bulbs_info'></span>
      </div>
    </div>`;

  $("#taxrates_content").html(dhtml);
  update_rates_dialog();
}

/**************************************************************************
  Shows tax rates dialog (redirects to the tab)
**************************************************************************/
function show_tax_rates_dialog()
{
  switch_to_govt_subtab(GOVT_TAB_TAXRATES);
  
  // Update content after switching
  setTimeout(function() {
    update_taxrates_tab_content();
  }, TAB_SWITCH_DELAY_MS * 1.5);
}

/**************************************************************************
  Updates the rates dialog with current values
**************************************************************************/
function update_rates_dialog()
{
  if (client_is_observer()) return;

  const currentMaxRate = government_max_rate(client.conn.playing['government']);
  RatesManager.setMaxRate(currentMaxRate);

  create_rates_sliders(
    client.conn.playing['tax'],
    client.conn.playing['luxury'],
    client.conn.playing['science'],
    currentMaxRate
  );

  const govt = governments[client.conn.playing['government']];
  $("#max_tax_rate").html(`<i>${govt['name']} max rate: ${currentMaxRate}%</i>`);
  
  update_net_income();
  update_net_bulbs();
}

/**************************************************************************
  Updates the net income display
**************************************************************************/
function update_net_income()
{
  const income = client.conn.playing['expected_income'];
  const net_income = income > 0 ? '+' + income : income;
  $("#income_info").html(net_income);
}

/**************************************************************************
  Updates the research bulbs display
**************************************************************************/
function update_net_bulbs(bulbs)
{
  if (bulbs === undefined) {
    const cbo = get_current_bulbs_output();
    bulbs = cbo.self_bulbs - cbo.self_upkeep;
  }
  if (bulbs > 0) {
    bulbs = "+" + bulbs;
  }
  $("#bulbs_info").html(bulbs);
}

/**************************************************************************
  Creates jQuery UI sliders for rates
**************************************************************************/
function create_rates_sliders(tax_val, lux_val, sci_val, max)
{
  RatesManager.setMaxRate(max);

  // Create Tax slider
  $("#slider-tax-jquery").slider({
    min: 0,
    max: max,
    step: 10,
    value: tax_val,
    slide: function(event, ui) {
      update_rate_slider('tax', ui.value);
    }
  });

  // Create Luxury slider
  $("#slider-lux-jquery").slider({
    min: 0,
    max: max,
    step: 10,
    value: lux_val,
    slide: function(event, ui) {
      update_rate_slider('luxury', ui.value);
    }
  });

  // Create Science slider
  $("#slider-sci-jquery").slider({
    min: 0,
    max: max,
    step: 10,
    value: sci_val,
    slide: function(event, ui) {
      update_rate_slider('science', ui.value);
    }
  });

  update_rates_labels();
}

/**************************************************************************
  Generic rate slider update function - eliminates code duplication
  @param rateType: 'tax', 'luxury', or 'science'
  @param newValue: the new value for this rate
**************************************************************************/
function update_rate_slider(rateType, newValue)
{
  if (RatesManager.isFrozen()) return;
  
  RatesManager.freeze();

  // Determine which rates are locked
  const locks = {
    tax: RatesManager.isLocked(0),
    luxury: RatesManager.isLocked(1),
    science: RatesManager.isLocked(2)
  };

  // Get current values
  let rates = {
    tax: $("#slider-tax-jquery").slider("value"),
    luxury: $("#slider-lux-jquery").slider("value"),
    science: $("#slider-sci-jquery").slider("value")
  };

  // Update the changed rate
  rates[rateType] = newValue;

  // Calculate total and adjust unlocked rates to maintain 100% sum
  let total = rates.tax + rates.luxury + rates.science;
  
  if (total !== 100) {
    // Get the other two rate types
    const otherRates = ['tax', 'luxury', 'science'].filter(r => r !== rateType);
    
    // Adjust unlocked rates proportionally
    const unlocked = otherRates.filter(r => !locks[r]);
    
    if (unlocked.length > 0) {
      const deficit = 100 - total;
      const perRate = Math.floor(deficit / unlocked.length / 10) * 10;
      
      unlocked.forEach((r, index) => {
        rates[r] = Math.min(Math.max(rates[r] + perRate, 0), RatesManager.getMaxRate());
        rates[r] = Math.floor(rates[r] / 10) * 10;
      });
    }
    
    // Final adjustment to ensure exactly 100%
    total = rates.tax + rates.luxury + rates.science;
    if (total !== 100) {
      const finalAdjust = 100 - total;
      if (!locks.tax && otherRates.includes('tax')) {
        rates.tax += finalAdjust;
      } else if (!locks.luxury && otherRates.includes('luxury')) {
        rates.luxury += finalAdjust;
      } else if (!locks.science && otherRates.includes('science')) {
        rates.science += finalAdjust;
      } else {
        rates[rateType] += finalAdjust;
      }
    }
  }

  // Update all sliders with calculated values
  $("#slider-tax-jquery").slider("value", rates.tax);
  $("#slider-lux-jquery").slider("value", rates.luxury);
  $("#slider-sci-jquery").slider("value", rates.science);

  // Update labels
  update_rates_labels();

  // Sync state using setters
  RatesManager.setTax(rates.tax);
  RatesManager.setLuxury(rates.luxury);
  RatesManager.setScience(rates.science);
  
  // Update legacy globals for backward compatibility
  tax = rates.tax;
  lux = rates.luxury;
  sci = rates.science;
  
  RatesManager.unfreeze();
  submit_player_rates();
}

/**************************************************************************
  Updates rate labels
**************************************************************************/
function update_rates_labels()
{
  RatesManager.setTax($("#slider-tax-jquery").slider("value"));
  RatesManager.setLuxury($("#slider-lux-jquery").slider("value"));
  RatesManager.setScience($("#slider-sci-jquery").slider("value"));

  // Sync with legacy globals
  tax = RatesManager.getTax();
  lux = RatesManager.getLuxury();
  sci = RatesManager.getScience();

  $("#tax_result").html(tax + "%");
  $("#lux_result").html(lux + "%");
  $("#sci_result").html(sci + "%");
}

/**************************************************************************
  Submits the current player rates to the server
**************************************************************************/
function submit_player_rates()
{
  // Validate that rates are within bounds and sum to 100
  if (RatesManager.getTax() < 0 || RatesManager.getTax() > 100 || 
      RatesManager.getLuxury() < 0 || RatesManager.getLuxury() > 100 || 
      RatesManager.getScience() < 0 || RatesManager.getScience() > 100) {
    swal("Invalid tax rate values - must be between 0% and 100%");
    return;
  }
  
  const total = RatesManager.getTax() + RatesManager.getLuxury() + RatesManager.getScience();
  if (total !== 100) {
    swal(`Invalid tax rates - total must equal 100% (currently ${total}%)`);
    return;
  }
  
  const packet = {
    "pid": packet_player_rates,
    "tax": RatesManager.getTax(),
    "luxury": RatesManager.getLuxury(),
    "science": RatesManager.getScience()
  };
  send_request(JSON.stringify(packet));
}
