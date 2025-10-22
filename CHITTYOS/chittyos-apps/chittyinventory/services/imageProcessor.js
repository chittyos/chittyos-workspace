const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

class ImageProcessor {
  constructor() {
    this.supportedFormats = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    this.maxImageSize = 10 * 1024 * 1024; // 10MB
    this.thumbnailSize = { width: 300, height: 300 };
  }

  async processImage(filePath) {
    try {
      // Validate file
      await this.validateImage(filePath);

      // Get image metadata
      const metadata = await this.getImageMetadata(filePath);

      // Optimize image if needed
      const optimizedPath = await this.optimizeImage(filePath);

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(optimizedPath);

      // Extract text if present
      const extractedText = await this.extractTextFromImage(optimizedPath);

      // Analyze image for item detection
      const itemAnalysis = await this.analyzeImageForItems(optimizedPath);

      return {
        originalPath: filePath,
        optimizedPath: optimizedPath,
        thumbnailPath: thumbnailPath,
        metadata: metadata,
        extractedText: extractedText,
        itemAnalysis: itemAnalysis,
      };
    } catch (error) {
      console.error("Image processing error:", error);
      throw error;
    }
  }

  async validateImage(filePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error("Image file not found");
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxImageSize) {
        throw new Error("Image file too large");
      }

      // Check file extension
      const extension = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(extension)) {
        throw new Error(`Unsupported image format: ${extension}`);
      }

      return true;
    } catch (error) {
      console.error("Image validation error:", error);
      throw error;
    }
  }

  async getImageMetadata(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        fileSize: fs.statSync(filePath).size,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
      };
    } catch (error) {
      console.error("Metadata extraction error:", error);
      throw new Error("Failed to extract image metadata");
    }
  }

  async optimizeImage(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      const filename = path.basename(filePath, path.extname(filePath));
      const optimizedPath = path.join(
        path.dirname(filePath),
        `${filename}_optimized.jpg`,
      );

      let sharpInstance = sharp(filePath);

      // Resize if image is too large
      if (metadata.width > 2048 || metadata.height > 2048) {
        sharpInstance = sharpInstance.resize(2048, 2048, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG with good quality
      await sharpInstance
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(optimizedPath);

      return optimizedPath;
    } catch (error) {
      console.error("Image optimization error:", error);
      // Return original path if optimization fails
      return filePath;
    }
  }

  async generateThumbnail(filePath) {
    try {
      const filename = path.basename(filePath, path.extname(filePath));
      const thumbnailPath = path.join(
        path.dirname(filePath),
        `${filename}_thumb.jpg`,
      );

      await sharp(filePath)
        .resize(this.thumbnailSize.width, this.thumbnailSize.height, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error("Thumbnail generation error:", error);
      return null;
    }
  }

  async extractTextFromImage(filePath) {
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log(m),
      });

      return {
        text: text.trim(),
        hasText: text.trim().length > 0,
      };
    } catch (error) {
      console.error("OCR error:", error);
      return {
        text: "",
        hasText: false,
        error: "Failed to extract text",
      };
    }
  }

  async analyzeImageForItems(filePath) {
    try {
      // This is a simplified version - in production you might use
      // computer vision APIs like Google Vision API, AWS Rekognition, etc.

      const analysis = {
        detectedObjects: [],
        suggestedCategories: [],
        confidence: 0,
        tags: [],
      };

      // Extract text and analyze for item keywords
      const textData = await this.extractTextFromImage(filePath);

      if (textData.hasText) {
        const keywords = this.extractKeywords(textData.text);
        analysis.tags = keywords;
        analysis.suggestedCategories = this.categorizeFromKeywords(keywords);
        analysis.confidence = keywords.length > 0 ? 0.7 : 0.1;
      }

      // Basic object detection based on image analysis
      const imageProperties = await this.analyzeImageProperties(filePath);
      analysis.detectedObjects = imageProperties.objects || [];

      return analysis;
    } catch (error) {
      console.error("Image analysis error:", error);
      return {
        detectedObjects: [],
        suggestedCategories: [],
        confidence: 0,
        tags: [],
        error: "Failed to analyze image",
      };
    }
  }

  extractKeywords(text) {
    const itemKeywords = [
      // Kitchen items
      "coffee",
      "tea",
      "pot",
      "pan",
      "knife",
      "fork",
      "spoon",
      "plate",
      "bowl",
      "microwave",
      "blender",
      "toaster",
      "refrigerator",
      "oven",
      "stove",

      // Furniture
      "chair",
      "table",
      "sofa",
      "couch",
      "bed",
      "dresser",
      "desk",
      "bookshelf",

      // Electronics
      "tv",
      "television",
      "computer",
      "laptop",
      "phone",
      "tablet",
      "speaker",
      "camera",
      "headphones",
      "charger",

      // Bathroom
      "towel",
      "soap",
      "shampoo",
      "mirror",
      "toilet",
      "shower",

      // Appliances
      "washer",
      "dryer",
      "vacuum",
      "dishwasher",
      "iron",

      // General
      "lamp",
      "clock",
      "frame",
      "picture",
      "book",
      "magazine",
    ];

    const words = text.toLowerCase().split(/\s+/);
    const foundKeywords = [];

    for (const word of words) {
      for (const keyword of itemKeywords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          if (!foundKeywords.includes(keyword)) {
            foundKeywords.push(keyword);
          }
        }
      }
    }

    return foundKeywords;
  }

  categorizeFromKeywords(keywords) {
    const categoryMappings = {
      Kitchen: [
        "coffee",
        "tea",
        "pot",
        "pan",
        "knife",
        "fork",
        "spoon",
        "plate",
        "bowl",
        "microwave",
        "blender",
        "toaster",
        "refrigerator",
        "oven",
        "stove",
      ],
      "Living Room": [
        "sofa",
        "couch",
        "chair",
        "table",
        "tv",
        "television",
        "speaker",
      ],
      Bedroom: ["bed", "dresser", "lamp", "clock"],
      Bathroom: ["towel", "soap", "shampoo", "mirror", "toilet", "shower"],
      Electronics: [
        "computer",
        "laptop",
        "phone",
        "tablet",
        "camera",
        "headphones",
        "charger",
      ],
      Appliances: ["washer", "dryer", "vacuum", "dishwasher", "iron"],
      Office: ["desk", "bookshelf", "computer", "laptop", "book"],
    };

    const suggestedCategories = [];

    for (const [category, categoryKeywords] of Object.entries(
      categoryMappings,
    )) {
      const matchCount = keywords.filter((keyword) =>
        categoryKeywords.includes(keyword),
      ).length;

      if (matchCount > 0) {
        suggestedCategories.push({
          category: category,
          confidence: matchCount / categoryKeywords.length,
          matchedKeywords: keywords.filter((keyword) =>
            categoryKeywords.includes(keyword),
          ),
        });
      }
    }

    // Sort by confidence
    return suggestedCategories.sort((a, b) => b.confidence - a.confidence);
  }

  async analyzeImageProperties(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();

      // Basic analysis based on image properties
      const analysis = {
        objects: [],
        colors: [],
        lighting: "unknown",
      };

      // Analyze image stats
      const stats = await sharp(filePath).stats();

      // Determine if image is likely to contain furniture vs small items
      const aspectRatio = metadata.width / metadata.height;

      if (aspectRatio > 1.5) {
        analysis.objects.push("horizontal_furniture");
      } else if (aspectRatio < 0.7) {
        analysis.objects.push("vertical_furniture");
      }

      // Analyze brightness
      if (stats.channels && stats.channels.length > 0) {
        const avgBrightness = stats.channels[0].mean;
        if (avgBrightness > 200) {
          analysis.lighting = "bright";
        } else if (avgBrightness < 50) {
          analysis.lighting = "dark";
        } else {
          analysis.lighting = "normal";
        }
      }

      return analysis;
    } catch (error) {
      console.error("Image properties analysis error:", error);
      return {
        objects: [],
        colors: [],
        lighting: "unknown",
      };
    }
  }

  async categorizeItems(items) {
    try {
      if (!Array.isArray(items)) {
        items = [items];
      }

      const categorizedItems = [];

      for (const item of items) {
        const categorizedItem = { ...item };

        // Use existing category suggestion if available
        if (!categorizedItem.suggestedCategory) {
          categorizedItem.suggestedCategory = this.suggestItemCategory(item);
        }

        // Add confidence score
        categorizedItem.categoryConfidence = this.calculateCategoryConfidence(
          categorizedItem.suggestedCategory,
          item,
        );

        categorizedItems.push(categorizedItem);
      }

      return categorizedItems;
    } catch (error) {
      console.error("Item categorization error:", error);
      throw error;
    }
  }

  suggestItemCategory(item) {
    const itemName = item.name || item.description || "";
    const itemLower = itemName.toLowerCase();

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
        "stove",
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

    for (const [category, keywords] of Object.entries(categoryMappings)) {
      if (keywords.some((keyword) => itemLower.includes(keyword))) {
        return category;
      }
    }

    return "Other";
  }

  calculateCategoryConfidence(category, item) {
    const itemName = (item.name || item.description || "").toLowerCase();

    // Simple confidence calculation based on keyword matches
    if (category === "Other") {
      return 0.3;
    }

    const keywords = this.getCategoryKeywords(category);
    const matchCount = keywords.filter((keyword) =>
      itemName.includes(keyword),
    ).length;

    return Math.min(0.9, 0.5 + matchCount * 0.2);
  }

  getCategoryKeywords(category) {
    const mappings = {
      Kitchen: ["kitchen", "cook", "food", "eat", "drink"],
      Bathroom: ["bath", "wash", "clean", "hygiene"],
      Bedroom: ["sleep", "bed", "bedroom"],
      "Living Room": ["living", "sit", "entertain"],
      Electronics: ["electronic", "digital", "tech"],
      Appliances: ["appliance", "machine", "automatic"],
    };

    return mappings[category] || [];
  }

  // Clean up temporary files
  async cleanup(filePaths) {
    try {
      if (!Array.isArray(filePaths)) {
        filePaths = [filePaths];
      }

      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
}

module.exports = ImageProcessor;
