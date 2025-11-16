import jwt from "jsonwebtoken";

// export const verifyToken = (req, res, next) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) return res.status(401).json({ message: "Access denied" });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     res.status(403).json({ message: "Invalid token" });
//   }
// };


export const verifyToken = (req, res, next) => {
  // header: "Authorization: Bearer <token>"
  const headerToken = req.headers?.authorization?.split(' ')[1];
  const cookieToken = req.cookies?.authToken;
  const token = headerToken || cookieToken;
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};





export const verifyAdmin = (req, res, next) => {
  // console.log("Decoded token user:", req.user);
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access forbidden: Admins only" });
  }
  next();
};
