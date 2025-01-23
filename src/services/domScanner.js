import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const scanWebsiteElements = async (url) => {
  try {
    // Make a request to the backend to scan the website
    const response = await axios.post(`${API_URL}/api/scan-elements`, { url });
    return response.data;
  } catch (error) {
    throw new Error("Failed to scan website elements: " + error.message);
  }
};

export const getElementDetails = (element) => {
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: Array.from(element.classList || []),
    attributes: Array.from(element.attributes || []).map((attr) => ({
      name: attr.name,
      value: attr.value,
    })),
    textContent: element.textContent?.trim() || null,
    children: element.children.length,
  };
};
