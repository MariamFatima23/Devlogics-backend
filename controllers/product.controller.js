const Product = require('../models/Product.model');

/**
 * POST /api/products
 * Add a new product. Completely standalone — no Finance link.
 */
const addProduct = async (req, res) => {
  try {
    const { name, price, purchaseDate, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (price === undefined || price === null || isNaN(price) || Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }

    const product = await Product.create({
      name:         name.trim(),
      price:        Number(price),
      purchaseDate: purchaseDate || Date.now(),
      description:  description?.trim() || '',
      createdBy:    req.user.id,
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/products
 * Returns all products sorted by purchaseDate descending (newest first).
 */
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ purchaseDate: -1 })
      .populate('createdBy', 'name email');

    res.json({ success: true, count: products.length, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/products/:id
 * Single product detail.
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/products/:id
 * Update a product.
 */
const updateProduct = async (req, res) => {
  try {
    const { name, price, purchaseDate, description } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, purchaseDate, description },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/products/:id
 * Delete a product.
 */
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { addProduct, getAllProducts, getProductById, updateProduct, deleteProduct };
