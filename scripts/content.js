/***********************************************************
 * SHARED UTILS / PRODUCTION PARSERS
 ***********************************************************/

/**
 * PRODUCTION: Parse leaf values (strings, numbers, booleans) from text content.
 */
function parseLeafValue(rawText) {
  let value = rawText.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  const lowerVal = value.toLowerCase();
  if (lowerVal === "true") return true;
  if (lowerVal === "false") return false;
  if (lowerVal === "null") return null;

  const asNumber = Number(value);
  if (!isNaN(asNumber) && value !== "") {
    return asNumber;
  }
  return value;
}

/**
 * PRODUCTION: Parse a single node in the production console.
 */
function parseNode(nodeElement) {
  const keySpan = nodeElement.querySelector(".database-key");
  if (!keySpan) return {};

  const fieldKey = keySpan.textContent.trim();
  const typeDiv = nodeElement.querySelector(
    ".database-buttons .database-type"
  );
  const typeText = typeDiv ? typeDiv.textContent.trim() : "(unknown)";

  let value;
  if (typeText === "(map)") {
    const mapContainer = nodeElement.querySelector(
      ":scope > .database-children"
    );
    value = parseMap(mapContainer);
  } else if (typeText === "(array)") {
    const arrayContainer = nodeElement.querySelector(
      ":scope > .database-children"
    );
    value = parseArray(arrayContainer);
  } else {
    const leafSpan = nodeElement.querySelector(".database-leaf-value");
    value = leafSpan ? parseLeafValue(leafSpan.textContent) : null;
  }

  return { [fieldKey]: value };
}

/**
 * PRODUCTION: Parse a Map container.
 */
function parseMap(databaseChildren) {
  const mapResult = {};
  if (!databaseChildren) return mapResult;

  const dataTrees = databaseChildren.querySelectorAll(":scope > f7e-data-tree");
  dataTrees.forEach((dataTree) => {
    const nodeElements = dataTree.querySelectorAll(":scope > .database-node");
    nodeElements.forEach((nodeElement) => {
      Object.assign(mapResult, parseNode(nodeElement));
    });
  });

  return mapResult;
}

/**
 * PRODUCTION: Parse an Array container.
 */
function parseArray(databaseChildren) {
  const resultArray = [];
  if (!databaseChildren) return resultArray;

  const dataTrees = databaseChildren.querySelectorAll(":scope > f7e-data-tree");
  dataTrees.forEach((dataTree) => {
    const nodeElements = dataTree.querySelectorAll(":scope > .database-node");
    nodeElements.forEach((nodeElement) => {
      const parsedObj = parseNode(nodeElement);
      for (const [key, value] of Object.entries(parsedObj)) {
        const index = parseInt(key, 10);
        if (!isNaN(index)) {
          resultArray[index] = value;
        }
      }
    });
  });

  return resultArray;
}

/***********************************************************
 * EMULATOR PARSERS
 ***********************************************************/

/**
 * EMULATOR: Parse leaf values based on the (type) label and raw value (usually from title attribute).
 */
function parseEmulatorLeafValue(raw, type) {
  const t = (type || "").toLowerCase();
  const val = raw === undefined || raw === null ? "" : String(raw).trim();

  if (t === "(null)") return null;
  if (t === "(boolean)") return val === "true";
  if (t === "(number)") return Number(val);

  // Strings in emulator usually appear like: "some value" (quotes included in the title attribute)
  if (t === "(string)") {
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.slice(1, -1);
    }
    return val;
  }

  // Fallback for timestamps, references, geopoints, etc.
  return val;
}

/**
 * EMULATOR: Helper to convert a map object (with numeric keys) to an array.
 */
function convertMapToArray(mapObj) {
  const keys = Object.keys(mapObj)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  if (keys.length === 0) return [];
  return keys.map((k) => mapObj[k]);
}

/**
 * EMULATOR: Recursively parse the .Firestore-Field-List or .FieldPreview-children container.
 */
function parseEmulatorContainer(container) {
  const data = {};
  if (!container) return data;

  // Items are usually direct <li> children with class .FieldPreview
  const items = container.querySelectorAll(":scope > li.FieldPreview");

  items.forEach((item) => {
    const keyElem = item.querySelector(".FieldPreview-key");
    if (!keyElem) return; // Skip if no key found

    const key = keyElem.textContent.trim();
    const typeElem = item.querySelector(".FieldPreview-type");
    const type = typeElem ? typeElem.textContent.trim() : "";

    let val;

    if (type === "(map)" || type === "(array)") {
      // Maps and Arrays have a sibling container .FieldPreview-children
      const nextSibling = item.nextElementSibling;
      if (
        nextSibling &&
        nextSibling.classList.contains("FieldPreview-children")
      ) {
        const children = parseEmulatorContainer(nextSibling);
        if (type === "(array)") {
          val = convertMapToArray(children);
        } else {
          val = children;
        }
      } else {
        // Empty map or array
        val = type === "(array)" ? [] : {};
      }
    } else {
      // Primitive value
      const summaryElem = item.querySelector(".FieldPreview-summary");
      // Prefer 'title' attribute for full value (e.g. un-truncated), fallback to text
      let raw = "";
      if (summaryElem) {
        raw = summaryElem.getAttribute("title");
        if (raw === null) {
          raw = summaryElem.textContent;
        }
      }
      val = parseEmulatorLeafValue(raw, type);
    }

    data[key] = val;
  });

  return data;
}

/***********************************************************
 * CORE LOGIC
 ***********************************************************/

function getFirestoreJSON(contextRoot = null) {
  // 1. Determine Context (Emulator vs Production) and Root
  let emulatorRoot = null;
  let productionPanel = null;

  if (contextRoot) {
    if (contextRoot.classList.contains("Firestore-Field-List")) {
      emulatorRoot = contextRoot;
    } else if (contextRoot.classList.contains("panel-container")) {
      productionPanel = contextRoot;
    } else {
      // Fallback or inference
      if (contextRoot.querySelector(".Firestore-Field-List")) {
        emulatorRoot = contextRoot.querySelector(".Firestore-Field-List");
      } else {
        productionPanel = contextRoot;
      }
    }
  } else {
    // Default / Global invocation
    const foundEmulator = document.querySelector(".Firestore-Field-List");
    if (foundEmulator) {
      emulatorRoot = foundEmulator;
    } else {
      const panelsContainer = document.querySelector(".panels-container");
      if (panelsContainer) {
        const panelContainers = panelsContainer.querySelectorAll(".panel-container");
        if (panelContainers.length > 0) {
          productionPanel = panelContainers[panelContainers.length - 1];
        }
      }
    }
  }

  // 2. Parse based on identified root
  if (emulatorRoot) {
    // --- EMULATOR PATH ---
    const data = parseEmulatorContainer(emulatorRoot);
    // Extract Doc ID from URL (Default)
    // TODO: If contextRoot is deeper, URL might not match. 
    // But Emulator usually shows one doc at a time or replaces view.
    const parts = window.location.pathname.split("/");
    const docId = parts.length > 0 ? parts[parts.length - 1] : "unknown_doc";

    const finalJson = { [docId]: data };
    return {
      status: "ok",
      docId,
      data: finalJson,
      jsonString: JSON.stringify(finalJson, null, 2),
    };

  } else if (productionPanel) {
    // --- PRODUCTION PATH ---
    // 1) Extract doc ID from THIS panel
    let docId = "UNKNOWN_DOCUMENT_ID";
    const docIdElement = productionPanel.querySelector(
      ":scope f7e-panel-header .label"
    );
    if (docIdElement) {
      docId = docIdElement.textContent.trim();
    }

    // 2) Collect fields from THIS panel
    const animateElements = productionPanel.querySelectorAll(
      "fs-animate-change-classes"
    );
    // Note: Empty docs are valid, but usually have at least one container.
    
    const dataObject = {};

    animateElements.forEach((element) => {
      const keySpan = element.querySelector(".database-key");
      if (!keySpan) return;

      const fieldKey = keySpan.textContent.trim();
      const typeDiv = element.querySelector(
        ".database-buttons .database-type"
      );
      const typeText = typeDiv ? typeDiv.textContent.trim() : "(unknown)";

      if (typeText === "(map)") {
        const mapContainer = element.querySelector(".database-children");
        dataObject[fieldKey] = parseMap(mapContainer);
      } else if (typeText === "(array)") {
        const arrayContainer = element.querySelector(".database-children");
        dataObject[fieldKey] = parseArray(arrayContainer);
      } else {
        const leafSpan = element.querySelector(".database-leaf-value");
        dataObject[fieldKey] = leafSpan
          ? parseLeafValue(leafSpan.textContent)
          : null;
      }
    });

    const finalJson = { [docId]: dataObject };
    return {
      status: "ok",
      docId,
      data: finalJson,
      jsonString: JSON.stringify(finalJson, null, 2),
    };

  } else {
    throw new Error("No Firestore data found (Production or Emulator).");
  }
}

/***********************************************************
 * UI INJECTION (Copy Button)
 ***********************************************************/

const COPY_BTN_CLASS = "firestore-json-downloader-copy-btn";

function createCopyButton(onClick) {
  const btn = document.createElement("button");
  btn.className = COPY_BTN_CLASS; // Use class instead of ID for multiple buttons
  btn.innerText = "Copy JSON";
  btn.title = "Copy Document JSON";
  btn.style.cssText = `
    background-color: transparent;
    color: #ffa500;
    border: 1px solid #ffa500;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    line-height: normal;
    z-index: 9999;
  `;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = onClick(); // Call the specific handler
      await navigator.clipboard.writeText(result.jsonString);
      
      const originalText = btn.innerText;
      btn.innerText = "Copied!";
      btn.style.color = "#188038";
      btn.style.borderColor = "#188038";
      
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.color = "#ffa500";
        btn.style.borderColor = "#ffa500";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy JSON:", err);
      btn.innerText = "Error";
      btn.style.color = "#d93025";
      btn.style.borderColor = "#d93025";
    }
  });

  return btn;
}

function injectEmulatorButton() {
  // 1. Emulator Injection
  // We want to attach to EVERY visible field list (though usually just one).
  const emulatorLists = document.querySelectorAll(".Firestore-Field-List");
  emulatorLists.forEach((list) => {
    // Check if we already injected into this list's scope
    // We'll store a flag on the list element to avoid duplicate checks if button moved
    if (list.dataset.hasJsonBtn === "true") return;

    // Try to find an "Add field" button nearby.
    // In emulator, it's often a sibling or in a header.
    // We'll look at the parent's children.
    const parent = list.parentElement;
    let targetBtn = null;

    // Look for any button that looks like a main action
    // Note: Emulator class names are generic. We might look for "Add field" text or aria-label.
    if (parent) {
      const buttons = parent.querySelectorAll("button");
      for (const b of buttons) {
        if (b.textContent.includes("Add field") || b.getAttribute("aria-label") === "Add field") {
          // Exclude buttons INSIDE the list (field-level adds)
          if (!list.contains(b)) {
            targetBtn = b;
            break;
          }
        }
      }
    }

    const btn = createCopyButton(() => getFirestoreJSON(list));

    if (targetBtn) {
      // Insert after "Add field"
      if (targetBtn.nextSibling !== btn) {
        targetBtn.after(btn);
        btn.style.margin = "0 0 0 10px";
      }
    } else {
      // Fallback: Insert before the list
      parent.insertBefore(btn, list);
      btn.style.margin = "0 0 8px 0";
    }

    list.dataset.hasJsonBtn = "true";
  });
}

function injectProductionButton() {

  // 2. Production Injection

  const panelContainers = document.querySelectorAll(".panel-container");

  panelContainers.forEach((panel) => {

    // Strategy: Find "Add field" text specifically

    let target = null;

    const spans = panel.querySelectorAll("span");

    for (const span of spans) {

      const text = span.textContent.trim();

      if (text === "Add field") {

        // Traverse up to find the button component or button element

        target = span.closest("f7e-panel-add-data-button") || span.closest("button");

        if (target) break;

      }

    }



    if (target) {

      // If the button is already there, don't re-inject

      if (panel.querySelector(`.${COPY_BTN_CLASS}`)) {

        return; 

      }



      const btn = createCopyButton(() => getFirestoreJSON(panel));

      // Insert after

      target.after(btn);



      // Styles for "Add Field" neighbor - strictly 0 margin

      btn.style.margin = "0";

      btn.style.alignSelf = "center";

      btn.style.display = "inline-block";

      

      panel.dataset.hasJsonBtn = "true";

    }

  });

}

function injectButton() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    injectEmulatorButton();
  } else if (host === "console.firebase.google.com") {
    injectProductionButton();
  }
}

// Observe DOM changes to inject button when panels load
const observer = new MutationObserver((mutations) => {
  // Simple debounce or check if valid target exists
  injectButton();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

/***********************************************************
 * MESSAGE LISTENER
 ***********************************************************/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetchFirestore") {
    return false;
  }

  try {
    const result = getFirestoreJSON();
    sendResponse({ status: "ok", data: result.jsonString });
  } catch (error) {
    console.error("Error parsing Firestore doc:", error);
    sendResponse({ status: "error", message: error.message });
  }

  // Indicate async response
  return true;
});