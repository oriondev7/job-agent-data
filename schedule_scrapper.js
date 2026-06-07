(function() {
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  window.receiveUserData = (userData) => {
    console.log("Got from Swift:", userData);
    automate(userData)
  };

  function sendToSwift(result) {
    console.log(`Sending results to the client: ${result}`)
    window.webkit.messageHandlers.dtekBridge.postMessage(result);
    console.log("Sent results to the client")
  }

  function clickButton(title) {
    const buttons = Array.from(document.querySelectorAll('.date'));
    if (!buttons) {
      throw new Error("Buttons selection failed.");
    }

    const button = buttons.find(button => button.textContent.includes(title));
    if (!button) {
      throw new Error(`There is no button named ${title} failed.`);
    }

    button.click();
    console.log(`Clicked ${title}`)
  }

  async function scrapeTwoDays() {
    const results = { day1: [], day2: [] };

    try {
      console.log("Day 1 data scraping is in progress")
      results.day1 = await getTableData();
      console.log("Day 1 data:")
      console.log(results.day1)
      
      clickButton("на завтра")
      // Wait for the table to refresh.
      // We look for the 'active' class to switch or the content to change.
      await delay(100);

      console.log("Day 2 data scraping is in progress")
      results.day2 = await getTableData(true);
      console.log("Day 2 data:")
      console.log(results.day2)

      clickButton("на сьогодні")
    } catch (error) {
      throw error
    }

    return results
  }

  async function getTableData(isDay2 = false) {
    const table = document.querySelector('.discon-fact-table.active');
    const infoMessage = document.querySelector('.discon-info-message');
    if (!table && infoMessage) {
      return []
    }
    if (!table) {
      throw new Error("Table selection failed.");
    }

    const container = table.querySelector('.table2col');
    if (!container) {
      throw new Error("Container selection failed.");
    }

    const currentHour = new Date().getHours();
    const rows = Array.from(container.querySelectorAll('tbody tr'))
    if (!rows) {
      throw new Error("Rows selection failed.");
    }

    return rows.map(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) { 
        return null
      }

      const time = cells[0].textContent.trim();
      const startHour = parseInt(time.split('-')[0]);
      const statusCell = cells[cells.length - 1];
      const classList = statusCell.classList
      let status = "POWER IS ON";

      if (classList.contains('cell-scheduled')) status = "OUTAGE";
      else if (classList.contains('cell-first-half')) status = "FIRST HALF OUTAGE";
      else if (classList.contains('cell-second-half')) status = "SECOND HALF OUTAGE";
      else if (classList.contains('cell-non-scheduled')) status = "POWER IS ON";

      return {
        time: time,
        status: status,
        isCurrent: !isDay2 && currentHour === startHour
      };
    }).filter(n => n);
  }

  // Helper to hide elements by selector
  function hide(selector) {
    const el = document.querySelector(selector);
    if (el) {
      el.setAttribute('style', 'display: none !important');
      console.log("Force Hidden:", selector);
    }
  }

  const closePopups = () => {
    const selectors = [
      '.modal__close.m-attention__close',
      'button.modal__close[data-micromodal-close]'
    ];
    selectors.forEach(selector => {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        console.log("Closed popup:", selector);
      }
    });
  };

  function capitalize(str) {
    if (!str) return ''; // Handles empty strings safely
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function clean(string) {
    return !string ? "" : string.trim().toLowerCase();
  }

  async function selectInput(selector, selectorValue, listSelector, listSelectorValue) {
    const selectorInput = document.getElementById(selector);

    if (!selectorInput) {
      throw new Error(`There is no ${selector} element.`);
    }

    closePopups();

    selectorInput.click();
    selectorInput.value = selectorValue;
    selectorInput.dispatchEvent(new Event('input', { bubbles: true }));

    await delay(100); // Wait for list to appear

    const selectorList = document.getElementById(listSelector);

    if (!selectorList) {
      throw new Error(`There is no list with the ${listSelector} ID.`);
    }

    const option = Array.from(selectorList.querySelectorAll('div'))
                        .find(item => clean(item.textContent) === clean(listSelectorValue));

    if (!option) {
      throw new Error(`There is no option for "${selectorValue}".`);
    }

    option.click();

    console.log(`${capitalize(selector)} is set and clicked`)
  }

  async function automate(userData) {
    console.log("DTEK Automation Started");

    // --- PHASE 0: Handling Failures (The "Oops" Message) ---
    // Set a global timeout
    const timeout = setTimeout(() => {
      sendToSwift({
        "status": "error",
        "message": "Timeout error.",
        "schedule": null
      });
    }, 5000); // 5 seconds
    console.log("Timer is set for 5 seconds");

    // --- PHASE 1: INITIAL CLEANUP ---
    // Close initial popups
    // This handles both the "Attention" pop-up and the generic modal
    closePopups();
    
    // hide('header.header');
    // hide('footer.footer');
    // hide('.breadcrumb'); // Targets the container-fluid with breadcrumb

    // <div class="discon-schedule-info desctop-version"><h1>...</h1><div class="info-describe">...</div></div>
    // hide('.discon-schedule-info.desctop-version');

    // hide('.discon-title.discon-schedule-title');
    // hide('.discon-schedule-table');
    // hide('#legendarium-table');
    // hide('.section.section--no-padding.section-class6');
    // hide('.section.section--no-padding.section-class-120');
    // hide('.section.section-faq');
    // hide('.contacts-us-btn');
    // hide('.scroll-up');

    // --- PHASE 2: DATA ENTRY ---
    try {
      // City
      const cityData = userData.city
      await selectInput(cityData.selector, cityData.selectorValue, cityData.listSelector, cityData.listSelectorValue)
      await delay(500);

      // Street
      const streetData = userData.street
      await selectInput(streetData.selector, streetData.selectorValue, streetData.listSelector, streetData.listSelectorValue)  
      await delay(500);

      // House
      const houseData = userData.house
      await selectInput(houseData.selector, houseData.selectorValue, houseData.listSelector, houseData.listSelectorValue)

      console.log("Data is filled out");

      // Scroll down to the schedule
      const scheduleTitle = document.querySelector('#discon-fact .discon-title');
      if (scheduleTitle) {
        const headerOffset = 80; // Height of the sticky header in pixels
        const elementPosition = scheduleTitle.getBoundingClientRect().top;
        const isElementFarThanOneThousand = elementPosition > 1000
        const correctElementPosition = isElementFarThanOneThousand ? elementPosition / 2 : elementPosition
        const correctHeaderOffset = isElementFarThanOneThousand ? headerOffset * 2 : headerOffset
        const offsetPosition = correctElementPosition - correctHeaderOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }

      // --- PHASE 3: FINAL CLEANUP ---
      // Remove the specific outage info block
      // await delay(500);
      // hide('#showCurOutage');

      //await scrapeAndSend();
      const schedule = await scrapeTwoDays();

      sendToSwift({
        "status": "dataScraped",
        "message": "Data is scraped",
        "schedule": schedule
      });
    } catch (error) {
      console.log(error.message)
      
      sendToSwift({
        "status": "error",
        "message": `${error.message}`,
        "schedule": null
      })

      clearTimeout(timeout)

      return
    }

    clearTimeout(timeout); // Success! Stop the timeout timer.
  }

  function waitForCityInput() {
    const citySelector = document.getElementById("city");

    if (citySelector) {
      sendToSwift({
          "status": "pageLoaded",
          "message": "Page is loaded",
          "schedule": null
      });
      return;
    }

    console.log(citySelector)

    setTimeout(waitForCityInput, 500);
  }

  // waitForCityInput();

  // Run when page is ready
  if (document.readyState === 'complete') {
    waitForCityInput()
  } else {
    window.addEventListener('load', waitForCityInput);
  }
})();
