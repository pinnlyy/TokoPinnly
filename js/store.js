import { db, isFirebaseConfigured } from "./firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PRODUCTS_COLLECTION = "products";
const CATEGORIES_COLLECTION = "categories";
const ORDERS_COLLECTION = "orders";

export { isFirebaseConfigured };

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function formatIDR(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
}

export function toJsDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toJsDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function sanitizeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function normalizePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeProduct(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: sanitizeText(data.name, "Produk Tanpa Nama"),
    categoryName: sanitizeText(data.categoryName, "Umum"),
    price: normalizePrice(data.price),
    stockStatus: sanitizeText(data.stockStatus, "Ready"),
    shortDescription: sanitizeText(data.shortDescription, "Produk digital Pinnly Store."),
    description: sanitizeText(data.description, "Belum ada deskripsi lengkap."),
    notes: sanitizeText(data.notes, ""),
    imageText: sanitizeText(data.imageText, "PINNLY"),
    imageUrl: sanitizeText(data.imageUrl || data.image || data.photo || data.thumbnail, ""),
    oldPrice: normalizePrice(data.oldPrice || data.comparePrice || data.beforePrice),
    discountPercent: normalizePrice(data.discountPercent || data.discount),
    soldCount: normalizePrice(data.soldCount || data.sold || data.orderCount),
    badge: sanitizeText(data.badge, ""),
    hot: data.hot === true || data.isHot === true,
    active: data.active === true,
    features: Array.isArray(data.features) ? data.features.filter(Boolean).map(String) : [],
    createdAt: data.createdAt || null
  };
}

function normalizeCategory(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: sanitizeText(data.name, "Kategori"),
    active: data.active === true,
    productCount: normalizePrice(data.productCount)
  };
}

export async function fetchCategories() {
  if (!isFirebaseConfigured) return [];

  const ref = collection(db, CATEGORIES_COLLECTION);
  const q = query(ref, where("active", "==", true));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(normalizeCategory)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function fetchProducts() {
  if (!isFirebaseConfigured) return [];

  const ref = collection(db, PRODUCTS_COLLECTION);
  const q = query(ref, where("active", "==", true));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(normalizeProduct)
    .filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function fetchProductById(productId) {
  if (!isFirebaseConfigured || !productId) return null;

  const ref = doc(db, PRODUCTS_COLLECTION, productId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;
  const product = normalizeProduct(snapshot);
  return product.active ? product : null;
}

export function filterAndSortProducts(products, { search = "", category = "all", sort = "newest" } = {}) {
  const keyword = search.trim().toLowerCase();

  const filtered = products.filter((product) => {
    const matchSearch = !keyword || [
      product.name,
      product.categoryName,
      product.shortDescription,
      product.description,
      product.imageText,
      ...product.features
    ].join(" ").toLowerCase().includes(keyword);

    const matchCategory = category === "all" || product.categoryName === category;
    return matchSearch && matchCategory;
  });

  return filtered.sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "name-asc") return a.name.localeCompare(b.name, "id");
    return String(b.id).localeCompare(String(a.id));
  });
}

export function generateInvoiceNumber() {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PIN-${datePart}-${randomPart}`;
}

export async function createOrder({ buyerName, buyerContact, product, paymentMethod }) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase config belum diisi. Buka js/firebase-config.js lalu isi firebaseConfig.");
  }

  if (!product?.id) {
    throw new Error("Produk tidak valid. Silakan pilih produk ulang.");
  }

  const invoice = generateInvoiceNumber();
  const order = {
    invoice,
    buyerName: sanitizeText(buyerName),
    buyerContact: sanitizeText(buyerContact),
    productId: product.id || "cart",
    productName: product.name,
    price: product.price,
    paymentMethod: sanitizeText(paymentMethod, "QRIS"),
    status: "Pending",
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, ORDERS_COLLECTION), order);

  localStorage.setItem("pinnly_last_invoice", JSON.stringify({
    ...order,
    createdAt: new Date().toISOString()
  }));

  return invoice;
}

export async function fetchOrderByInvoice(invoice) {
  if (!isFirebaseConfigured || !invoice) return null;

  const ref = collection(db, ORDERS_COLLECTION);
  const q = query(ref, where("invoice", "==", invoice), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const orderDoc = snapshot.docs[0];
  return {
    id: orderDoc.id,
    ...orderDoc.data()
  };
}

export function getLastInvoiceFromStorage() {
  try {
    const raw = localStorage.getItem("pinnly_last_invoice");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
