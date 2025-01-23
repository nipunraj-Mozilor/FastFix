import axios from "axios";
import { getIssueRecommendations } from "./langchain";

// Function to get fix suggestions for issues
export const getFixSuggestions = async (issues) => {
  try {
    const suggestions = {};

    // Process each issue in parallel
    await Promise.all(
      issues.map(async (issue) => {
        const recommendations = await getIssueRecommendations(issue);
        suggestions[issue.title] = recommendations.map((rec) => ({
          description: rec.suggestion,
          code: rec.codeExample,
          impact: rec.expectedImpact,
          implementation: rec.implementation,
        }));
      })
    );

    return suggestions;
  } catch (error) {
    throw new Error("Failed to get fix suggestions: " + error.message);
  }
};

// Function to validate and apply fixes
export const applyFix = async (issue, fixSuggestion) => {
  try {
    if (!fixSuggestion || !fixSuggestion.code) {
      throw new Error("Invalid fix suggestion");
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock successful fix application
    return {
      success: true,
      message: "Fix applied successfully",
      changes: fixSuggestion.code,
    };
  } catch (error) {
    throw new Error("Failed to apply fix: " + error.message);
  }
};

// Function to generate direct element selector
const generateDirectSelector = (element) => {
  if (!element) return null;

  // If this is the target element (like img, button, etc)
  const targetElement = element.querySelector ? element : element.element; // Handle both DOM and JSON representations
  if (!targetElement) return null;

  // Get tag name
  const tagName = targetElement.tagName
    ? targetElement.tagName.toLowerCase()
    : targetElement.nodeName.toLowerCase();

  // Check for ID
  const id = targetElement.id || targetElement.getAttribute?.("id");
  if (id) {
    return `#${id}`;
  }

  // Get classes
  const classList =
    targetElement.classList ||
    (targetElement.className ? targetElement.className.split(" ") : []) ||
    targetElement.getAttribute?.("class")?.split(" ") ||
    [];

  // If element has classes, use them
  if (classList.length > 0) {
    const uniqueClasses = Array.from(new Set(classList))
      .filter((cls) => cls && cls.trim())
      .map((cls) => `.${cls.trim()}`);
    if (uniqueClasses.length > 0) {
      return `${tagName}${uniqueClasses.join("")}`;
    }
  }

  // If no classes or ID, try to find a unique attribute
  const attributes = ["src", "href", "role", "type", "name"].filter(
    (attr) => targetElement.getAttribute?.(attr) || targetElement[attr]
  );

  if (attributes.length > 0) {
    const attr = attributes[0];
    const value = targetElement.getAttribute?.(attr) || targetElement[attr];
    // Use the last part of the path for src/href to keep it shorter
    const attrValue =
      attr === "src" || attr === "href" ? value.split("/").pop() : value;
    return `${tagName}[${attr}="${attrValue}"]`;
  }

  // As a last resort, generate a unique data attribute
  const uniqueId = Math.random().toString(36).substr(2, 9);
  const dataAttr = `data-element="${tagName}-${uniqueId}"`;
  if (targetElement.setAttribute) {
    targetElement.setAttribute("data-element", `${tagName}-${uniqueId}`);
  }
  return `${tagName}[${dataAttr}]`;
};

// Function to get affected elements based on issue type
export const getAffectedElements = async (url, issueType) => {
  try {
    // Create a selector based on issue type
    const getSelector = (type) => {
      switch (type) {
        case "missing-alt":
          return {
            baseSelector: 'img:not([alt]), img[alt=""]',
            targetTag: "img",
            directOnly: true,
          };
        case "image-size":
          return {
            baseSelector: "img[src]:not([width]):not([height])",
            targetTag: "img",
            directOnly: true,
          };
        case "color-contrast":
          return {
            // Direct selectors for text elements
            baseSelector: `
              p, h1, h2, h3, h4, h5, h6, span, a, button, label, li, td, th, 
              div[class*="text"], div[class*="title"], div[class*="heading"],
              *[style*="color"]
            `,
            targetTag: [
              "p",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "span",
              "a",
              "button",
              "label",
              "div",
            ],
            directOnly: true,
          };
        case "keyboard-nav":
          return {
            // Direct selectors for interactive elements
            baseSelector: `
              a, button, input, select, textarea,
              [role="button"], [role="link"], [role="tab"],
              [tabindex]
            `,
            targetTag: ["a", "button", "input", "select", "textarea"],
            directOnly: true,
          };
        case "aria-label":
          return {
            // Direct selectors for elements needing ARIA labels
            baseSelector: `
              button, a[href], input, select, textarea,
              [role], [aria-label], [aria-labelledby]
            `,
            targetTag: ["button", "a", "input", "select", "textarea"],
            directOnly: true,
          };
        case "form-label":
          return {
            // Direct selectors for form elements
            baseSelector: `
              input:not([type="hidden"]), select, textarea,
              [role="textbox"], [role="combobox"], [role="listbox"]
            `,
            targetTag: ["input", "select", "textarea"],
            directOnly: true,
          };
        case "heading-order":
          return {
            baseSelector: "h1, h2, h3, h4, h5, h6",
            targetTag: ["h1", "h2", "h3", "h4", "h5", "h6"],
            directOnly: true,
          };
        case "link-text":
          return {
            baseSelector: "a[href], [role='link']",
            targetTag: ["a"],
            directOnly: true,
          };
        default:
          return {
            baseSelector: "*[data-accessibility-issue]",
            targetTag: "*",
            directOnly: true,
          };
      }
    };

    const selectorInfo = getSelector(issueType);

    const response = await axios.post("/api/analyze-elements", {
      url,
      selector: selectorInfo.baseSelector,
      targetTag: selectorInfo.targetTag,
      directOnly: selectorInfo.directOnly, // Tell backend to avoid chained selectors
    });

    // Transform the response to include direct selectors
    const elements = response.data.elements.map((element) => {
      const directSelector = generateDirectSelector(element);
      return {
        ...element,
        selector: directSelector, // Use direct selector as primary selector
        directSelector,
        originalSelector: element.selector, // Keep the original selector as backup
      };
    });

    return elements;
  } catch (error) {
    throw new Error("Failed to get affected elements: " + error.message);
  }
};

// Enhanced validation function
export const validateFix = async (issue, appliedFix, element) => {
  try {
    const validationChecks = {
      "missing-alt": (el) =>
        el.hasAttribute("alt") && el.getAttribute("alt").trim() !== "",
      "image-size": (el) =>
        el.hasAttribute("width") && el.hasAttribute("height"),
      "color-contrast": (el) => {
        // Would need to implement color contrast calculation
        return true; // Placeholder
      },
      "keyboard-nav": (el) => {
        const tabindex = el.getAttribute("tabindex");
        return tabindex === null || parseInt(tabindex) >= 0;
      },
      "aria-label": (el) =>
        el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
      "form-label": (el) => {
        const id = el.getAttribute("id");
        return id
          ? document.querySelector(`label[for="${id}"]`) !== null
          : false;
      },
      "heading-order": (el) => {
        // Validate heading order
        return true; // Placeholder
      },
      "link-text": (el) => {
        const text = el.textContent || el.innerText;
        return text && text.trim().length > 0;
      },
    };

    // Always use direct selector
    const elementSelector = element.directSelector;

    // Simulate validation with API call
    const response = await axios.post("/api/validate-fix", {
      issue,
      element: {
        ...element,
        selector: elementSelector,
      },
      fix: appliedFix,
      validationType: issue.type,
    });

    return {
      success: response.data.success,
      message: response.data.message || "Fix has been validated successfully",
      details: response.data.details || {},
      selector: elementSelector,
    };
  } catch (error) {
    throw new Error("Failed to validate fix: " + error.message);
  }
};
