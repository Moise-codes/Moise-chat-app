import jwt from "jsonwebtoken"
export const generateToken = (userId, res) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "1d"
    })
    res.cookie("jwt", token, {
        // ✅ no maxAge = session cookie — deleted when browser closes
        // every time browser is closed and reopened, user must login again
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production"
    });
    return token;
};