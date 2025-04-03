class ProductFormPriceUpdater {
  constructor() {
    this.form = document.getElementById("albumDetailsForm");
    this.priceSelectors = ".price__regular .price-item--regular, .price__sale .price-item--sale";
    this.basePrice = this.getBasePrice();
    this.selectedOptions = new Map();
    this.fixedBarPrice = document.querySelector(".total-price-amount");
    this.mediaOptions = document.querySelectorAll('input[name="properties[media-type]"]');
    this.displayOptions = document.querySelectorAll(
      "#display-section .album-details-form__field"
    );
    this.keyholeMountsSection = document.getElementById(
      "keyhole-mounts-section"
    );
    this.recordSizeSection = document.getElementById("record-size-section");
    this.serviceTypeSection = document.getElementById("service-type-section");
    this.serviceTypeOptions = document.querySelectorAll(".service-type-option");

    // Initialize state
    this.init();
  }

  /**
   * 
   * @returns 
   */
  init() {
    if (!this.form) return;

    // Set default media type to records
    this.currentMediaType = "records";
    this.checkFirstRadiosInGroups();
    this.initializeEventListeners();
    this.initializeSelectedOptions();
    this.handleCustomNoteVisibility();
    this.setupFormDataCollection();
    this.initializeDisplayFiltering();
    this.initializeKeyholeMountsVisibility();
    this.initializeServiceTypeVisibility();
  }

  getBasePrice() {
    const priceElement = document.querySelector(this.priceSelectors);
    if (!priceElement) return 0;

    // Remove currency symbol and convert to number
    const price = priceElement.textContent.replace(/[^0-9.-]/g, "");
    return parseFloat(price);
  }

  checkFirstRadiosInGroups() {
    if (!this.form) return;

    // Get all unique radio button names (groups)
    const radioGroups = new Set();
    this.form.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radioGroups.add(radio.name);
    });

    // For each group, check the first radio button
    radioGroups.forEach((groupName) => {
      const firstRadio = this.form.querySelector(
        `input[type="radio"][name="${groupName}"]`
      );
      if (firstRadio) {
        firstRadio.checked = true;
        // Trigger change event
        const event = new Event("change", {
          bubbles: true,
          cancelable: true,
        });
        firstRadio.dispatchEvent(event);
      }
    });
  }

  initializeEventListeners() {
    if (!this.form) return;
    const priceRangeSlider = document.getElementById("priceSlider");
    if (priceRangeSlider) {
      priceRangeSlider.addEventListener("input", (e) => {
        this.handlePriceRangeChange(e);
      });
    }
    
    // Listen for changes on all radio inputs
    this.form.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        // Ensure the clicked radio is checked
        input.checked = true;
        
        // Uncheck other radios in the same group
        this.form.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => {
          if (radio !== input) {
            radio.checked = false;
          }
        });

        this.handleOptionChange(e);

        if (input.name === "properties[display-preference]") {
          this.handleCustomNoteVisibility();
        }

        // Only handle media type changes for visibility
        if (input.name === "properties[media-type]") {
          const selectedType = input.getAttribute("data-type");
          this.currentMediaType = selectedType;
          console.log("Media type changed:", selectedType);
          this.filterDisplayOptions(selectedType);
          this.toggleKeyholeMounts(selectedType);
          this.updateServiceTypeVisibility(selectedType);
        }
      });
    });

    // Listen for changes on keyhole mount checkboxes
    if (this.keyholeMountsSection) {
      this.keyholeMountsSection.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          this.handleKeyholeMountChange(e);
        });
      });
    }
  }

  handlePriceRangeChange(event) {
    const priceValue = document.getElementById("priceRangeSlider").textContent;
    console.log(priceValue, "priceValue");
    const sliderValue = parseFloat(priceValue);
    this.selectedOptions.set("sliderPrice", sliderValue);
    if (!isNaN(sliderValue) && sliderValue >= 0) {
      this.selectedOptions.set("sliderPrice", sliderValue);
    } else {
      this.selectedOptions.set("sliderPrice", 0);
    }
    this.updateTotalPrice();
  }

  updateTotalPrice() {
    let totalPrice = this.basePrice;

    // Add all selected option prices (including negative values for discounts)
    for (let price of this.selectedOptions.values()) {
      totalPrice += price;
    }

    // Ensure price doesn't go below 0
    totalPrice = Math.max(0, totalPrice);

    // Format price with appropriate currency
    const formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(totalPrice);

    // Update all price elements on the page
    document.querySelectorAll(this.priceSelectors).forEach((element) => {
      element.textContent = formattedPrice;
    });

    // Update fixed bar price
    if (this.fixedBarPrice) {
      this.fixedBarPrice.textContent = formattedPrice;
    }

    // Dispatch custom event for other components that might need to know about price updates
    this.form.dispatchEvent(
      new CustomEvent("price:updated", {
        detail: { price: totalPrice },
        bubbles: true,
      })
    );
  }

  handleCustomNoteVisibility() {
    const customNoteSection = this.form.querySelector(
      '.form-section:has(textarea[name="properties[custom-note]"])'
    );
    if (!customNoteSection) return;

    const selectedDisplay = this.form.querySelector(
      'input[name="properties[display-preference]"]:checked'
    );
    if (
      selectedDisplay &&
      selectedDisplay.value.toLowerCase().includes("custom")
    ) {
      customNoteSection.style.display = "block";
    } else {
      customNoteSection.style.display = "none";
    }
  }

  initializeSelectedOptions() {
    // Get all pre-selected radio inputs
    this.form
      .querySelectorAll('input[type="radio"]:checked')
      .forEach((input) => {
        const priceElement = input
          .closest(".radio-container")
          .querySelector(".option-price");
        if (priceElement) {
          const price = this.extractPrice(priceElement.textContent);
          this.selectedOptions.set(input.name, price);
        }
      });

    // Update price initially
    this.updateTotalPrice();
  }

  handleOptionChange(event) {
    const input = event.target;
    const container = input.closest(".radio-container");
    const priceElement = container.querySelector(".option-price");

    if (priceElement) {
      const price = this.extractPrice(priceElement.textContent);
      this.selectedOptions.set(input.name, price);
    } else {
      this.selectedOptions.delete(input.name);
    }

    this.updateTotalPrice();
  }

  extractPrice(priceString) {
    if (!priceString) return 0;
    // Remove currency symbol and any other non-numeric characters except decimal point and minus
    const price = priceString.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  }

  setupFormDataCollection() {
    // Listen for the form:data event from product-info.js
    document.addEventListener("form:data", (event) => {
      if (!event.detail || !event.detail.form) return;

      // Add our custom properties to the form data
      const properties = this.collectFormProperties();

      // Get the existing form data from the event
      const formData = event.detail.form;

      // Add our properties to the form data
      formData.append("properties", JSON.stringify(properties));
    });
  }

  collectFormProperties() {
    const properties = {};

    // Collect radio button selections
    this.form
      .querySelectorAll('input[type="radio"]:checked')
      .forEach((radio) => {
        const fieldLabel = this.getFieldLabel(radio);
        const value = radio.value;
        const price = this.getOptionPrice(radio);

        // Remove 'properties[]' from the field label for cleaner display
        const cleanLabel = fieldLabel.replace('properties[', '').replace(']', '');
        properties[cleanLabel] = {
          value: value,
          price: price || 0,
        };
      });

    // Collect custom note if visible
    const customNoteField = this.form.querySelector(
      'textarea[name="properties[custom-note]"]'
    );
    if (
      customNoteField &&
      customNoteField.closest(".form-section").style.display !== "none"
    ) {
      properties["Custom Note"] = {
        value: customNoteField.value,
        price: 0,
      };
    }

    return properties;
  }

  getFieldLabel(input) {
    // Try to find the section title first
    const section = input.closest(".form-section");
    if (section) {
      const title = section.querySelector(".form-title");
      if (title) return title.textContent.trim();
    }

    // Fallback to input name
    return input.name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  getOptionPrice(input) {
    const container = input.closest(".radio-container");
    if (!container) return 0;

    const priceElement = container.querySelector(".option-price");
    if (!priceElement) return 0;

    return this.extractPrice(priceElement.textContent);
  }

  initializeDisplayFiltering() {
    // Initialize display filtering on first load
    const checkedOption = document.querySelector(
      'input[name="properties[media-type]"]:checked'
    );
    if (checkedOption) {
      const selectedType = checkedOption.getAttribute("data-type");
      this.filterDisplayOptions(selectedType);
      this.toggleKeyholeMounts(selectedType);
    }

    // Add event listeners for media options
    this.mediaOptions.forEach((option) => {
      option.addEventListener("change", (e) => {
        const selectedType = e.target.getAttribute("data-type");
        this.filterDisplayOptions(selectedType);
        this.toggleKeyholeMounts(selectedType);
      });
    });
  }

  initializeKeyholeMountsVisibility() {
    if (!this.keyholeMountsSection) {
      console.log("Keyhole mounts section not found");
      return;
    }

    const checkedOption = this.form.querySelector(
      'input[name="properties[media-type]"]:checked'
    );
    if (checkedOption) {
      const selectedType = checkedOption.getAttribute("data-type");
      console.log("Initial media type:", selectedType);
      this.toggleKeyholeMounts(selectedType);
    } else {
      console.log("No checked media option found");
    }
  }

  toggleKeyholeMounts(selectedType) {
    if (!this.keyholeMountsSection) return;

    const isRecordType = selectedType === "records";
    this.recordSizeSection.style.display = isRecordType ? "block" : "none";
    this.keyholeMountsSection.style.display = isRecordType ? "block" : "none";

    if (!isRecordType) {
      // If not record type, uncheck all keyhole mount checkboxes and remove their prices
      const keyholeInputs = this.keyholeMountsSection.querySelectorAll('input[type="checkbox"]');
      keyholeInputs.forEach((input) => {
        if (input.checked) {
          input.checked = false;
          const optionKey = `keyhole-mount-${input.value}`;
          this.selectedOptions.delete(optionKey);
        }
      });
      this.updateTotalPrice();
    }
  }

  initializeServiceTypeVisibility() {
    // Initial visibility update based on default selection
    const defaultSelected = document.querySelector(
      'input[name="properties[media-type]"]:checked'
    );
    if (defaultSelected) {
      this.updateServiceTypeVisibility(defaultSelected.dataset.type);
    }

    // Add event listeners for media variant changes
    this.mediaOptions.forEach((input) => {
      input.addEventListener("change", (e) => {
        const selectedType = e.target.dataset.type;
        this.updateServiceTypeVisibility(selectedType);
      });
    });
  }

  updateServiceTypeVisibility(selectedType) {
    if (!this.serviceTypeOptions) {
      console.log("No service type options found");
      return;
    }

    console.log("Updating service type visibility for:", selectedType);
    
    // First pass - show/hide options and find first visible one
    let firstVisibleOption = null;
    this.serviceTypeOptions.forEach((option) => {
      const allowedTypes = (option.dataset.allowedTypes || "").split(",");
      console.log("Option allowed types:", allowedTypes);
      
      if (!allowedTypes.length || allowedTypes.includes(selectedType)) {
        option.style.display = "block";
        if (!firstVisibleOption) {
          firstVisibleOption = option;
        }
      } else {
        option.style.display = "none";
      }
    });

    // Second pass - handle radio selection
    if (firstVisibleOption) {
      console.log("Found first visible option");
      const currentChecked = this.form.querySelector('input[name="properties[service-type]"]:checked');
      
      // If current checked radio is hidden or none is checked, select first visible
      if (!currentChecked || currentChecked.closest('.service-type-option').style.display === 'none') {
        const radioToCheck = firstVisibleOption.querySelector('input[type="radio"]');
        if (radioToCheck) {
          console.log("Checking first visible radio");
          if (currentChecked) {
            currentChecked.checked = false;
          }
          radioToCheck.checked = true;
          radioToCheck.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } else {
      console.log("No visible service type options found");
    }
  }

  filterDisplayOptions(selectedType) {
    console.log("Filtering display options for type:", selectedType);
    let firstVisibleOption = null;

    this.displayOptions.forEach((option) => {
      const optionType = option.getAttribute("data-type");
      const shouldDisplay = optionType === selectedType;
      option.style.display = shouldDisplay ? "block" : "none";
      
      if (shouldDisplay && !firstVisibleOption) {
        firstVisibleOption = option;
      }
    });

    // Handle radio selection for display preferences
    if (firstVisibleOption) {
      console.log("Found first visible display option");
      const currentChecked = this.form.querySelector('input[name="properties[display-preference]"]:checked');
      
      // If current checked radio is hidden or none is checked, select first visible
      if (!currentChecked || currentChecked.closest('.album-details-form__field').style.display === 'none') {
        const radioToCheck = firstVisibleOption.querySelector('input[type="radio"]');
        if (radioToCheck) {
          console.log("Checking first visible display radio");
          if (currentChecked) {
            currentChecked.checked = false;
          }
          radioToCheck.checked = true;
          radioToCheck.dispatchEvent(new Event("change", { bubbles: true }));
          this.handleCustomNoteVisibility();
        }
      }
    } else {
      console.log("No visible display options found");
    }
  }

  handleKeyholeMountChange(event) {
    const checkbox = event.target;
    const price = parseFloat(checkbox.dataset.price || 0);
    const optionKey = `keyhole-mount-${checkbox.value}`;

    if (checkbox.checked) {
      this.selectedOptions.set(optionKey, price);
    } else {
      this.selectedOptions.delete(optionKey);
    }

    this.updateTotalPrice();
  }
}

// Initialize the price updater when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ProductFormPriceUpdater();
});
