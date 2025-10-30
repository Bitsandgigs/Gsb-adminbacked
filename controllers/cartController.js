const Cart = require("../models/Cart");

exports.addToCart = async (req, res) => {
  try {
    const { userId, product } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [product] });
    } else {
      const existingItem = cart.items.find(
        (item) => item.productId == product.productId,
      );
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.items.push(product);
      }
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart", cart });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error adding to cart", error: err.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.find({ userId: req.params.userId });
    res.status(200).json({ cart });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching cart", error: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { userId,  productId } = req.body;


    console.log("typeof productId:", typeof productId);


    console.log("Removing item:", userId, productId);
    let cart = await Cart.findOne({ userId });

    console.log("Current cart before removal:", cart);
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    // return res.status(200).json({ message: "Item removed", data : cart.items });

    cart.items = cart.items.filter((item) => item.productId != productId);

    // return res.status(200).json({ message: "Item removed", data : cart.items });

    await cart.save();

    res.status(200).json({ message: "Item removed", cart });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error removing item", error: err.message });
  }
};

exports.updateCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((item) => item.productId === productId);
    if (!item)
      return res.status(404).json({ message: "Item not found in cart" });

    if (quantity <= 0) {
      cart.items = cart.items.filter((item) => item.productId !== productId);
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    res.status(200).json({ message: "Cart updated", cart });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating cart", error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.findOneAndDelete({ userId });
    res.status(200).json({ message: "Cart cleared" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error clearing cart", error: err.message });
  }
};
