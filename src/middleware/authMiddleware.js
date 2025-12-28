import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // Check if JWT_SECRET is set
  if (!process.env.JWT_SECRET) {
    console.error('[verifyToken] JWT_SECRET is not set in environment variables!');
    return res.status(500).json({ message: 'Server configuration error. Please contact support.' });
  }

  // header: "Authorization: Bearer <token>"
  const headerToken = req.headers?.authorization?.split(' ')[1];
  const cookieToken = req.cookies?.authToken;
  const token = headerToken || cookieToken;

  console.log('[verifyToken] ===== TOKEN VERIFICATION =====');
  console.log('[verifyToken] Has header token:', !!headerToken);
  console.log('[verifyToken] Has cookie token:', !!cookieToken);
  console.log('[verifyToken] Token length:', token ? token.length : 0);
  console.log('[verifyToken] JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('[verifyToken] JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);

  if (!token) {
    console.error('[verifyToken] No token provided');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[verifyToken] Token verified successfully');
    console.log('[verifyToken] User ID:', decoded.id);
    console.log('[verifyToken] Token expires at:', new Date(decoded.exp * 1000).toISOString());
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[verifyToken] Token verification failed');
    console.error('[verifyToken] Error name:', err.name);
    console.error('[verifyToken] Error message:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      console.error('[verifyToken] Token expired at:', new Date(err.expiredAt).toISOString());
      return res.status(403).json({ message: 'Token has expired. Please log in again.' });
    } else if (err.name === 'JsonWebTokenError') {
      console.error('[verifyToken] Invalid token format or signature');
      return res.status(403).json({ message: 'Invalid token. Please log in again.' });
    } else {
      console.error('[verifyToken] Unknown error:', err);
      return res.status(403).json({ message: 'Token verification failed. Please log in again.' });
    }
  }
};


export const verifyAdmin = (req, res, next) => {
  // FIXED: Check both 'role' and 'is_admin' boolean to match your userRepository.js
  if (!req.user || (req.user.role !== "admin" && req.user.is_admin !== true)) {
    console.warn(`[verifyAdmin] Access denied for User ID: ${req.user?.id}`);
    return res.status(403).json({ message: "Access forbidden: Admins only" });
  }
  
  console.log(`[verifyAdmin] Admin access granted for User ID: ${req.user.id}`);
  next();
};
