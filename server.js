const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data");
const UPLOADS = path.join(__dirname, "public", "uploads");
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
const productsFile = path.join(DATA, "products.json");
const ordersFile = path.join(DATA, "orders.json");
if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, "[]");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]");

const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const write = (f, x) => fs.writeFileSync(f, JSON.stringify(x, null, 2));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function admin(req, res, next) {
  const supplied = req.headers["x-admin-password"];
  if (!process.env.ADMIN_PASSWORD || supplied !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Admin password is incorrect." });
  }
  next();
}
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.get("/api/config", (_, res) => res.json({ publicKey: process.env.PAYSTACK_PUBLIC_KEY || "", currency: "GHS" }));
app.get("/api/products", (_, res) => res.json(read(productsFile)));

app.post("/api/admin/products", admin, upload.single("image"), (req, res) => {
  const { name, description = "", price, category = "General", stock = "10" } = req.body;
  const amount = Number(price), quantity = Number(stock);
  if (!name || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Enter a product name and valid price." });
  const products = read(productsFile);
  const item = {
    id: crypto.randomUUID(), name, description, price: amount,
    category, stock: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
    image: req.file ? "/uploads/" + req.file.filename : ""
  };
  products.push(item); write(productsFile, products);
  res.json(item);
});

app.delete("/api/admin/products/:id", admin, (req, res) => {
  const products = read(productsFile);
  write(productsFile, products.filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

app.post("/api/orders/checkout", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: "Online payments are not configured yet. Add your Paystack secret key on the server." });
    const { customer, items } = req.body;
    if (!customer?.name || !customer?.email || !customer?.phone || !customer?.address || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "Please complete your contact, delivery and cart details." });

    const products = read(productsFile);
    const verifiedItems = items.map(row => {
      const p = products.find(x => x.id === row.id);
      const qty = Math.floor(Number(row.quantity));
      if (!p || qty < 1 || qty > p.stock) throw new Error("An item is unavailable or the quantity exceeds stock.");
      return { id: p.id, name: p.name, quantity: qty, unitPrice: p.price };
    });
    const total = verifiedItems.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
    const reference = "RSI-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
    const site = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customer.email,
        amount: Math.round(total * 100),
        currency: "GHS",
        reference,
        callback_url: site + "/payment-return.html",
        metadata: { customer, items: verifiedItems, custom_fields: [{ display_name: "Order", variable_name: "order_reference", value: reference }] }
      })
    });
    const result = await response.json();
    if (!response.ok || !result.status) return res.status(502).json({ error: result.message || "Could not start payment." });
    const orders = read(ordersFile);
    orders.push({ reference, customer, items: verifiedItems, total, status: "Payment pending", tracking: "", createdAt: new Date().toISOString() });
    write(ordersFile, orders);
    res.json({ authorizationUrl: result.data.authorization_url, reference });
  } catch (e) {
    res.status(400).json({ error: e.message || "Checkout failed." });
  }
});

app.get("/api/orders/verify/:reference", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: "Payments are not configured." });
    const r = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(req.params.reference), {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const result = await r.json();
    if (!r.ok || !result.status) return res.status(400).json({ error: result.message || "Could not verify payment." });
    const orders = read(ordersFile);
    const order = orders.find(o => o.reference === req.params.reference);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (result.data.status === "success" && result.data.currency === "GHS" && Number(result.data.amount) === Math.round(order.total * 100)) {
      order.status = "Paid";
      write(ordersFile, orders);
    }
    res.json({ status: order.status, reference: order.reference, total: order.total });
  } catch {
    res.status(500).json({ error: "Payment verification failed." });
  }
});

app.post("/api/track", (req, res) => {
  const { reference, phone } = req.body || {};
  const order = read(ordersFile).find(o => o.reference === reference && o.customer.phone === phone);
  if (!order) return res.status(404).json({ error: "We could not find an order with those details." });
  res.json({ status: order.status, tracking: order.tracking || "Tracking number will appear here once your order is dispatched." });
});

app.listen(PORT, () => console.log(`ROCK STAR IMPORTATION running on port ${PORT}`));
