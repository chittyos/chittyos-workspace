const Tesseract = require("tesseract.js");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");

class ReceiptProcessor {
  constructor() {
    this.supportedFormats = [".jpg", ".jpeg", ".png", ".gif", ".pdf"];
  }

  async processReceipt(filePath) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();

      if (!this.supportedFormats.includes(fileExtension)) {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      let extractedText;

      if (fileExtension === ".pdf") {
        extractedText = await this.processPDFReceipt(filePath);
      } else {
        extractedText = await this.processImageReceipt(filePath);
      }

      // Parse the extracted text to identify items, prices, dates, etc.
      const parsedData = await this.parseReceiptData(extractedText);

      return {
        rawText: extractedText,
        parsedData: parsedData,
        filePath: filePath,
      };
    } catch (error) {
      console.error("Receipt processing error:", error);
      throw error;
    }
  }

  async processImageReceipt(filePath) {
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log(m),
      });
      return text;
    } catch (error) {
      console.error("OCR processing error:", error);
      throw new Error("Failed to extract text from image");
    }
  }

  async processPDFReceipt(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  async parseReceiptData(text) {
    try {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const parsed = {
        merchant: this.extractMerchant(lines),
        date: this.extractDate(lines),
        total: this.extractTotal(lines),
        items: this.extractItems(lines),
        address: this.extractAddress(lines),
        phoneNumber: this.extractPhoneNumber(lines),
      };

      return parsed;
    } catch (error) {
      console.error("Receipt parsing error:", error);
      return {
        merchant: null,
        date: null,
        total: null,
        items: [],
        address: null,
        phoneNumber: null,
        error: "Failed to parse receipt data",
      };
    }
  }

  extractMerchant(lines) {
    // Look for merchant name in the first few lines
    const merchantPatterns = [/^([A-Z\s]+)$/, /^([A-Z][a-zA-Z\s&]+)$/];

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      for (const pattern of merchantPatterns) {
        const match = line.match(pattern);
        if (match && match[1].length > 2 && match[1].length < 50) {
          return match[1].trim();
        }
      }
    }

    return null;
  }

  extractDate(lines) {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/,
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            const date = new Date(match[1]);
            if (!isNaN(date.getTime())) {
              return date.toISOString().split("T")[0];
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    return null;
  }

  extractTotal(lines) {
    const totalPatterns = [
      /total[:\s]*\$?(\d+\.\d{2})/i,
      /amount[:\s]*\$?(\d+\.\d{2})/i,
      /^total\s+(\d+\.\d{2})$/i,
      /\$(\d+\.\d{2})$/,
    ];

    // Check lines from bottom up as total is usually at the end
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }

    return null;
  }

  extractItems(lines) {
    const items = [];
    const itemPatterns = [
      /^(.+?)\s+(\d+\.\d{2})$/,
      /^(.+?)\s+\$(\d+\.\d{2})$/,
      /^(\d+)\s+(.+?)\s+(\d+\.\d{2})$/,
      /^(.+?)\s+(\d+)\s+@\s+(\d+\.\d{2})/,
    ];

    const skipPatterns = [
      /^(total|subtotal|tax|discount|change|cash|credit|debit)/i,
      /^thank\s+you/i,
      /^receipt/i,
      /^\d{4,}$/, // Long numbers (receipt numbers, etc.)
      /^[\d\s\-\(\)]+$/, // Phone numbers
    ];

    for (const line of lines) {
      // Skip lines that match skip patterns
      if (skipPatterns.some((pattern) => pattern.test(line))) {
        continue;
      }

      // Try to match item patterns
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          let item = {};

          if (match.length === 3) {
            // Format: "Item Name 12.99"
            item = {
              name: match[1].trim(),
              price: parseFloat(match[2]),
              quantity: 1,
            };
          } else if (match.length === 4) {
            if (line.includes("@")) {
              // Format: "Item Name 2 @ 12.99"
              item = {
                name: match[1].trim(),
                quantity: parseInt(match[2]),
                price: parseFloat(match[3]),
              };
            } else {
              // Format: "2 Item Name 12.99"
              item = {
                quantity: parseInt(match[1]),
                name: match[2].trim(),
                price: parseFloat(match[3]),
              };
            }
          }

          if (item.name && item.price > 0) {
            // Try to categorize the item
            item.suggestedCategory = this.suggestCategory(item.name);
            items.push(item);
          }
          break;
        }
      }
    }

    return items;
  }

  extractAddress(lines) {
    const addressPatterns = [
      /(\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5})/,
      /(\d+\s+[A-Za-z\s]+\s+[A-Za-z\s]+)/,
    ];

    for (const line of lines) {
      for (const pattern of addressPatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }

    return null;
  }

  extractPhoneNumber(lines) {
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;

    for (const line of lines) {
      const match = line.match(phonePattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  suggestCategory(itemName) {
    const categoryMappings = {
      Kitchen: [
        "coffee",
        "tea",
        "sugar",
        "salt",
        "pepper",
        "spice",
        "flour",
        "oil",
        "sauce",
        "pasta",
        "rice",
        "cereal",
        "bread",
        "milk",
        "cheese",
        "pot",
        "pan",
        "knife",
        "fork",
        "spoon",
        "plate",
        "bowl",
        "cup",
        "blender",
        "toaster",
        "microwave",
        "oven",
        "refrigerator",
      ],
      Bathroom: [
        "soap",
        "shampoo",
        "conditioner",
        "toothpaste",
        "toothbrush",
        "towel",
        "toilet paper",
        "tissue",
        "mirror",
        "shower",
      ],
      Bedroom: [
        "bed",
        "mattress",
        "pillow",
        "sheet",
        "blanket",
        "comforter",
        "dresser",
        "nightstand",
        "lamp",
        "clock",
      ],
      "Living Room": [
        "sofa",
        "couch",
        "chair",
        "table",
        "tv",
        "television",
        "remote",
        "speaker",
        "cushion",
        "rug",
        "carpet",
      ],
      Electronics: [
        "phone",
        "laptop",
        "computer",
        "tablet",
        "charger",
        "cable",
        "battery",
        "headphone",
        "speaker",
        "camera",
        "tv",
      ],
      Appliances: [
        "washer",
        "dryer",
        "dishwasher",
        "vacuum",
        "iron",
        "microwave",
        "toaster",
        "blender",
        "coffee maker",
      ],
    };

    const itemLower = itemName.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryMappings)) {
      if (keywords.some((keyword) => itemLower.includes(keyword))) {
        return category;
      }
    }

    return "Other";
  }

  // Validate receipt data before saving
  validateReceiptData(data) {
    const errors = [];

    if (!data.items || data.items.length === 0) {
      errors.push("No items found in receipt");
    }

    data.items.forEach((item, index) => {
      if (!item.name || item.name.trim().length === 0) {
        errors.push(`Item ${index + 1}: Missing name`);
      }

      if (!item.price || item.price <= 0) {
        errors.push(`Item ${index + 1}: Invalid price`);
      }

      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Invalid quantity`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

module.exports = ReceiptProcessor;
