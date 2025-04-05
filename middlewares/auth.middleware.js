import jwt from 'jsonwebtoken';

export const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ 
        message: 'Invalid or expired token',
        error: err.message 
      });
    }
    
    req.user = payload;
    next();
  });
};