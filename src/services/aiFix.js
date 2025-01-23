import axios from "axios";

// Mock data for testing
const mockSuggestions = {
  "Buttons do not have an accessible name": [
    {
      description: "Add aria-label to button elements",
      code: `<button aria-label="Menu Toggle">
  <svg>...</svg>
</button>`,
      impact: "Improves accessibility for screen readers",
    },
    {
      description: "Add visible text content to buttons",
      code: `<button>
  <svg>...</svg>
  <span class="sr-only">Menu</span>
</button>`,
      impact: "Provides visible and accessible button labels",
    },
  ],
  "Image elements do not have [alt] attributes": [
    {
      description: "Add descriptive alt text to images",
      code: `<img src="example.jpg" alt="Description of the image">`,
      impact: "Makes images accessible to screen readers",
    },
  ],
  "Properly size images": [
    {
      description: "Add width and height attributes to prevent layout shifts",
      code: `<img 
  src="image.jpg" 
  width="800" 
  height="600" 
  alt="Description"
  loading="lazy"
>`,
      impact: "Reduces layout shifts and improves loading performance",
    },
    {
      description: "Use responsive images with srcset",
      code: `<img 
  src="small.jpg"
  srcset="small.jpg 300w,
          medium.jpg 600w,
          large.jpg 900w"
  sizes="(max-width: 320px) 300px,
         (max-width: 640px) 600px,
         900px"
  alt="Description"
>`,
      impact: "Serves optimal image size based on device screen",
    },
    {
      description: "Optimize image format and compression",
      code: `<!-- Convert to WebP format -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>`,
      impact: "Reduces image file size while maintaining quality",
    },
  ],
  "Images with low resolution": [
    {
      description: "Use higher resolution images with proper compression",
      code: `<img 
  src="high-res.jpg"
  srcset="high-res.jpg 2x,
          low-res.jpg 1x"
  alt="Description"
>`,
      impact: "Improves image quality on high-DPI displays",
    },
  ],
  "Serve images in next-gen formats": [
    {
      description: "Convert images to WebP format with fallback",
      code: `<picture>
  <source 
    type="image/webp"
    srcset="image.webp"
  >
  <source
    type="image/jpeg"
    srcset="image.jpg"
  >
  <img 
    src="image.jpg"
    alt="Description"
    loading="lazy"
  >
</picture>`,
      impact: "Reduces image size by 25-35% compared to JPEG/PNG",
    },
  ],
  "Defer offscreen images": [
    {
      description: "Add lazy loading to images below the fold",
      code: `<img 
  src="image.jpg" 
  loading="lazy"
  alt="Description"
>`,
      impact: "Improves initial page load time",
    },
  ],
};

// Function to get fix suggestions for issues
export const getFixSuggestions = async (issues) => {
  try {
    // For testing, return mock suggestions instead of making API call
    const suggestions = {};
    issues.forEach((issue) => {
      if (mockSuggestions[issue.title]) {
        suggestions[issue.title] = mockSuggestions[issue.title];
      } else {
        // Provide a default suggestion if no specific one exists
        suggestions[issue.title] = [
          {
            description: `Suggested fix for: ${issue.title}`,
            code: `// Example fix for ${issue.title}
// Add appropriate HTML/CSS/JS fixes based on the issue`,
            impact: "Improves overall performance and user experience",
          },
        ];
      }
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

// Function to validate the applied fix
export const validateFix = async (issue, appliedFix) => {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock validation result
    return {
      success: true,
      message:
        "Fix has been validated and applied successfully. The element now meets accessibility standards.",
    };
  } catch (error) {
    throw new Error("Failed to validate fix: " + error.message);
  }
};
