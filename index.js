/**
 * XPosts API Server
 *
 * A RESTful API server for managing blog posts using Express.js and Supabase.
 *
 * Features:
 * - CRUD operations for posts
 * - CORS enabled for frontend integration
 * - Environment-based configuration
 * - Comprehensive error handling
 * - Request validation
 *
 * @author Sharan
 * @version 1.0.0
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================

/**
 * Load environment variables from .env file
 * This must be called before accessing process.env variables
 */
dotenv.config();

// ==================== EXPRESS APP SETUP ====================

/**
 * Create Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * Configure CORS (Cross-Origin Resource Sharing)
 * Allows frontend applications to make requests to this API
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // Allow specific frontend URL or all origins
    credentials: true, // Allow cookies and authentication headers
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * Parse incoming JSON requests
 * This middleware parses JSON payloads and makes them available in req.body
 */
app.use(
  express.json({
    limit: "10mb", // Limit JSON payload size to prevent abuse
    strict: true, // Only parse arrays and objects
  })
);

/**
 * Parse URL-encoded requests
 * This middleware parses form data and makes it available in req.body
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ==================== SUPABASE CLIENT ====================

/**
 * Supabase client configuration
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false, // Disable session persistence for API usage
    },
  }
);

// ==================== VALIDATION MIDDLEWARE ====================

/**
 * Validates post data for creation/update operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validatePostData = (req, res, next) => {
  const { title, body, user_id } = req.body;

  // Check for required fields
  if (!title || !body || !user_id) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
      details: "Title, body, and user_id are required",
    });
  }

  // Validate field types and constraints
  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid title",
      details: "Title must be a non-empty string",
    });
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid body",
      details: "Body must be a non-empty string",
    });
  }

  if (!Number.isInteger(user_id) || user_id < 1) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id",
      details: "User ID must be a positive integer",
    });
  }

  // Sanitize and trim data
  req.body = {
    title: title.trim(),
    body: body.trim(),
    user_id: parseInt(user_id),
  };

  next();
};

/**
 * Error handling middleware for async route handlers
 * Wraps async functions to catch and handle errors properly
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handling middleware
 * Handles all uncaught errors in the application
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  console.error("Error occurred:", err);

  // Default error response
  let statusCode = 500;
  let message = "Internal Server Error";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
    statusCode = 503;
    message = "Service Unavailable";
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString(),
  });
};

// ==================== ROUTES ====================

/**
 * Health check endpoint
 * GET /api/health
 *
 * @route GET /api/health
 * @desc Check if the API server is running
 * @access Public
 * @returns {Object} Server status information
 */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "XPosts API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * Get all posts
 * GET /api/posts
 *
 * @route GET /api/posts
 * @desc Retrieve all blog posts from the database
 * @access Public
 * @returns {Array<Object>} Array of post objects
 * @returns {Object} Error object if request fails
 */
app.get(
  "/api/posts",
  asyncHandler(async (req, res) => {
    try {
      console.log("Fetching all posts...");

      // Query posts from Supabase
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, user_id, created_at, updated_at")
        .order("created_at", { ascending: false }); // Order by newest first

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({
          success: false,
          error: "Database error",
          details: error.message,
        });
      }

      console.log(`Successfully fetched ${data.length} posts`);

      res.json({
        success: true,
        data: data,
        count: data.length,
      });
    } catch (err) {
      console.error("Unexpected error in GET /api/posts:", err);
      throw err; // Let errorHandler catch this
    }
  })
);

/**
 * Create a new post
 * POST /api/posts
 *
 * @route POST /api/posts
 * @desc Create a new blog post
 * @access Public
 * @param {Object} req.body - Post data
 * @param {string} req.body.title - Post title
 * @param {string} req.body.body - Post content
 * @param {number} req.body.user_id - ID of the user creating the post
 * @returns {Object} Created post object
 * @returns {Object} Error object if request fails
 */
app.post(
  "/api/posts",
  validatePostData,
  asyncHandler(async (req, res) => {
    try {
      const { title, body, user_id } = req.body;

      console.log(`Creating new post: "${title}" by user ${user_id}`);

      // Insert new post into Supabase
      const { data, error } = await supabase
        .from("posts")
        .insert([
          {
            title,
            body,
            user_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id, title, body, user_id, created_at, updated_at")
        .single(); // Return single object instead of array

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({
          success: false,
          error: "Database error",
          details: error.message,
        });
      }

      console.log(`Successfully created post with ID: ${data.id}`);

      res.status(201).json({
        success: true,
        data: data,
        message: "Post created successfully",
      });
    } catch (err) {
      console.error("Unexpected error in POST /api/posts:", err);
      throw err; // Let errorHandler catch this
    }
  })
);

/**
 * Get a specific post by ID
 * GET /api/posts/:id
 *
 * @route GET /api/posts/:id
 * @desc Retrieve a specific blog post by its ID
 * @access Public
 * @param {string} req.params.id - Post ID
 * @returns {Object} Post object
 * @returns {Object} Error object if post not found or request fails
 */
app.get(
  "/api/posts/:id",
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ID parameter
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
          details: "Post ID must be a valid number",
        });
      }

      console.log(`Fetching post with ID: ${id}`);

      // Query specific post from Supabase
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, user_id, created_at, updated_at")
        .eq("id", parseInt(id))
        .single();

      if (error) {
        console.error("Supabase error:", error);
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Post not found",
            details: `No post found with ID: ${id}`,
          });
        }
        return res.status(500).json({
          success: false,
          error: "Database error",
          details: error.message,
        });
      }

      console.log(`Successfully fetched post: ${data.title}`);

      res.json({
        success: true,
        data: data,
      });
    } catch (err) {
      console.error("Unexpected error in GET /api/posts/:id:", err);
      throw err; // Let errorHandler catch this
    }
  })
);

// ==================== ERROR HANDLING ====================

/*
 * Handle 404 errors for undefined routes
 * This middleware should be placed after all route definitions
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    details: `The requested route ${req.method} ${req.originalUrl} does not exist`,
    availableRoutes: [
      "GET /api/health",
      "GET /api/posts",
      "POST /api/posts",
      "GET /api/posts/:id",
    ],
  });
});

/*
 * Global error handling middleware
 * This should be the last middleware in the stack
 */
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

/**
 * Server configuration
 * @type {number} Port number for the server
 */

const PORT = process.env.PORT;

/**
 * Start the Express server
 * @param {number} port - Port number to listen on
 * @param {Function} callback - Callback function to execute when server starts
 */
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 XPosts API Server Started Successfully!");
  console.log("=".repeat(50));
  console.log(`📍 Server running on port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/posts`);
  console.log("=".repeat(50));
});

/*
 * Graceful shutdown handler
 * Handles process termination signals for clean server shutdown
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

// ==================== EXPORTS ====================

/**
 * Export the Express app for testing purpose
 * @type {express.Application}
 */
export default app;
