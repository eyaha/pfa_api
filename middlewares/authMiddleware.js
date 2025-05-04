import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET || "your_default_secret_key";

export const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
console.log("decoded",decoded);

      // Get user from the token (excluding password)
      req.user = await User.findById(decoded.userId).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Non autorisé, utilisateur non trouvé" });
      }

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error("Erreur d\'authentification:", error);
      res.status(401).json({ message: "Non autorisé, token invalide" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Non autorisé, pas de token" });
  }
};

// Optional: Middleware for admin roles (if needed later)
// export const admin = (req, res, next) => {
//   if (req.user && req.user.isAdmin) { // Assuming an isAdmin field in User model
//     next();
//   } else {
//     res.status(403).json({ message: "Accès refusé, rôle admin requis" });
//   }
// };

