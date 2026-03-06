import jwt from "jsonwebtoken"
export const generateToken = (userId,res) => {
    const token = jwt.sign({userId},process.env.JWT_SECRET,{
        expiresIn:"1d"
    })
  res.cookie("jwt",token,{
    maxAge: 1 * 24 * 60 * 60 * 1000, //MS
    httpOnly: true, // prevent xss attacks cross-site scripting attacks
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // ✅ fixed for cross-domain
    secure: process.env.NODE_ENV === "production" // ✅ fixed for HTTPS
  });
  return token;
};