const Chat = require("../models/Chat");
const TeamMember = require("../models/TeamMember");
const mongoose = require("mongoose");
const { uploadFileToGCS } = require("../services/s3Uploader");

exports.createChat = async (req, res) => {
  try {
    const { customerName, customerEmail, message } = req.body;

    const newChat = new Chat({
      customerName,
      customerEmail,
      messages: [{ sender: "customer", text: message }],
    });

    await newChat.save();
    req.app.get("io").emit("newChat", newChat);
    res.status(201).json({ message: "Chat initiated", data: newChat });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create chat", error: error.message });
  }
};

exports.getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find().populate(
      "assignedTo",
      "fullName email department",
    );
    res
      .status(200)
      .json({ message: "Chats fetched", count: chats.length, data: chats });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch chats", error: err.message });
  }
};

exports.assignChat = async (req, res) => {
  try {
    const { chatId, memberId } = req.body;

    const chat = await Chat.findById(chatId);
    const member = await TeamMember.findById(memberId);

    if (!chat || !member) {
      return res.status(404).json({ message: "Chat or team member not found" });
    }

    chat.assignedTo = memberId;
    await chat.save();

    member.assignedChats.push(chat._id);
    await member.save();

    req.app.get("io").to(chatId).emit("chatAssigned", { chatId, memberId });
    res.status(200).json({ message: "Chat assigned successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to assign chat", error: err.message });
  }
};

exports.getAssignedChats = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await TeamMember.findById(memberId).populate({
      path: "assignedChats",
      select: "customerName status createdAt messages",
    });

    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    res.status(200).json({
      message: "Assigned chats fetched successfully",
      count: member.assignedChats.length,
      data: member.assignedChats,
    });
  } catch (err) {
    console.error("Error fetching assigned chats:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch assigned chats", error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      messages,
      chatType = "general",
    } = req.body;
    const file = req.files?.media;

    if (!customerName) {
      return res.status(400).json({ message: "Customer name is required" });
    }
    if (!customerEmail) {
      return res.status(400).json({ message: "Customer email is required" });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        message: "Messages array with at least one message is required",
      });
    }

    let chat = await Chat.findOne({ customerEmail, status: "open" });

    const message = {
      sender: "customer",
      text: messages[0].text?.trim() || "",
      timestamp: new Date(),
    };

    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message:
            "Invalid file type. Only images, videos, and PDFs are allowed.",
        });
      }

      const folder = file.mimetype.startsWith("image")
        ? "chat/images"
        : file.mimetype.startsWith("video")
          ? "chat/videos"
          : "chat/pdfs";
      const fileUrl = await uploadFileToGCS(file, folder);
      message.media = {
        type: file.mimetype.startsWith("image")
          ? "image"
          : file.mimetype.startsWith("video")
            ? "video"
            : "pdf",
        url: fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
      };
    }

    if (!chat) {
      chat = await Chat.create({
        customerName,
        customerEmail,
        chatType,
        messages: [message],
      });
    } else {
      chat.messages.push(message);
      await chat.save();
    }

    req.app.get("io").to(chat._id.toString()).emit("newMessage", {
      chatId: chat._id,
      message,
    });

    const populatedChat = await Chat.findById(chat._id).populate(
      "assignedTo",
      "fullName email department",
    );

    res.status(200).json({
      message: "Message sent successfully",
      data: populatedChat,
    });
  } catch (err) {
    console.error("Error in sendMessage:", err);
    res
      .status(500)
      .json({ message: "Failed to send message", error: err.message });
  }
};

exports.replyToChat = async (req, res) => {
  const { chatId } = req.params;
  const { text, agentId, media } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID format" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const message = {
      sender: "agent",
      text: text?.trim() || "",
      timestamp: new Date(),
    };

    // Handle media from S3 upload (already uploaded, just add metadata)
    if (media) {
      message.media = {
        type: media.type,
        url: media.url,
        fileName: media.fileName,
        fileSize: media.fileSize,
      };
    }

    chat.messages.push(message);

    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      chat.assignedTo = agentId;
    }

    await chat.save();

    req.app.get("io").to(chatId).emit("newMessage", {
      chatId,
      message,
    });

    const populatedChat = await Chat.findById(chatId).populate(
      "assignedTo",
      "fullName email department",
    );

    res.status(200).json({
      message: "Reply sent successfully",
      data: populatedChat,
    });
  } catch (err) {
    console.error("Error in replyToChat:", err);
    res.status(500).json({ message: "Reply failed", error: err.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID format" });
    }

    const chat = await Chat.findById(chatId).populate(
      "assignedTo",
      "fullName email department",
    );
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    res.status(200).json({
      message: "Chat fetched successfully",
      data: chat,
    });
  } catch (err) {
    console.error("Error in getChatById:", err);
    res
      .status(500)
      .json({ message: "Error fetching chat", error: err.message });
  }
};

exports.markChatResolved = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID format" });
    }

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { status: "resolved" },
      { new: true },
    ).populate("assignedTo", "fullName email department");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    req.app.get("io").to(chatId).emit("chatResolved", { chatId });
    res.status(200).json({ message: "Chat marked as resolved", data: chat });
  } catch (err) {
    console.error("Error in markChatResolved:", err);
    res
      .status(500)
      .json({ message: "Failed to mark chat as resolved", error: err.message });
  }
};
// const Chat = require("../models/Chat");
// const TeamMember = require("../models/TeamMember");
// const mongoose = require("mongoose");

// exports.createChat = async (req, res) => {
//   try {
//     const { customerName, customerEmail, message } = req.body;

//     const newChat = new Chat({
//       customerName,
//       customerEmail,
//       messages: [{ sender: "customer", text: message }],
//     });

//     await newChat.save();
//     res.status(201).json({ message: "Chat initiated", data: newChat });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Failed to create chat", error: error.message });
//   }
// };

// exports.getAllChats = async (req, res) => {
//   try {
//     const chats = await Chat.find().populate(
//       "assignedTo",
//       "fullName email department"
//     );
//     res
//       .status(200)
//       .json({ message: "Chats fetched", count: chats.length, data: chats });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: "Failed to fetch chats", error: err.message });
//   }
// };

// exports.assignChat = async (req, res) => {
//   try {
//     const { chatId, memberId } = req.body;

//     const chat = await Chat.findById(chatId);
//     const member = await TeamMember.findById(memberId);

//     if (!chat || !member) {
//       return res.status(404).json({ message: "Chat or team member not found" });
//     }

//     chat.assignedTo = memberId;
//     await chat.save();

//     member.assignedChats.push(chat._id);
//     await member.save();

//     res.status(200).json({ message: "Chat assigned successfully" });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: "Failed to assign chat", error: err.message });
//   }
// };

// exports.getAssignedChats = async (req, res) => {
//   try {
//     const { memberId } = req.params;

//     const member = await TeamMember.findById(memberId).populate({
//       path: "assignedChats",
//       select: "customerName status createdAt messages",
//     });

//     if (!member) {
//       return res.status(404).json({ message: "Team member not found" });
//     }

//     res.status(200).json({
//       message: "Assigned chats fetched successfully",
//       count: member.assignedChats.length,
//       data: member.assignedChats,
//     });
//   } catch (err) {
//     console.error("Error fetching assigned chats:", err);
//     res
//       .status(500)
//       .json({ message: "Failed to fetch assigned chats", error: err.message });
//   }
// };

// exports.sendMessage = async (req, res) => {
//   try {
//     const {
//       customerName,
//       customerEmail,
//       messages,
//       chatType = "general",
//     } = req.body;

//     // Validate request body
//     if (!customerName) {
//       return res.status(400).json({ message: "Customer name is required" });
//     }
//     if (!customerEmail) {
//       return res.status(400).json({ message: "Customer email is required" });
//     }
//     if (!messages || !Array.isArray(messages) || messages.length === 0) {
//       return res.status(400).json({
//         message: "Messages array with at least one message is required",
//       });
//     }
//     if (!messages[0].text || messages[0].text.trim() === "") {
//       return res.status(400).json({ message: "Message text is required" });
//     }

//     let chat = await Chat.findOne({ customerEmail, status: "open" });

//     if (!chat) {
//       chat = await Chat.create({
//         customerName,
//         customerEmail,
//         chatType,
//         messages: [{ sender: "customer", text: messages[0].text.trim() }],
//       });
//     } else {
//       chat.messages.push({ sender: "customer", text: messages[0].text.trim() });
//       await chat.save();
//     }

//     // Populate assignedTo in the response
//     const populatedChat = await Chat.findById(chat._id).populate(
//       "assignedTo",
//       "fullName email department"
//     );

//     res.status(200).json({
//       message: "Message sent successfully",
//       data: populatedChat,
//     });
//   } catch (err) {
//     console.error("Error in sendMessage:", err);
//     res
//       .status(500)
//       .json({ message: "Failed to send message", error: err.message });
//   }
// };

// exports.replyToChat = async (req, res) => {
//   const { chatId } = req.params;
//   const { text, agentId } = req.body;

//   try {
//     if (!mongoose.Types.ObjectId.isValid(chatId)) {
//       return res.status(400).json({ message: "Invalid chat ID format" });
//     }

//     if (!text || text.trim() === "") {
//       return res.status(400).json({ message: "Message text is required" });
//     }

//     const chat = await Chat.findById(chatId);
//     if (!chat) return res.status(404).json({ message: "Chat not found" });

//     chat.messages.push({ sender: "agent", text: text.trim() });

//     if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
//       chat.assignedTo = agentId;
//     }

//     await chat.save();

//     const populatedChat = await Chat.findById(chatId).populate(
//       "assignedTo",
//       "fullName email department"
//     );

//     res.status(200).json({
//       message: "Reply sent successfully",
//       data: populatedChat,
//     });
//   } catch (err) {
//     console.error("Error in replyToChat:", err);
//     res.status(500).json({ message: "Reply failed", error: err.message });
//   }
// };

// exports.getChatById = async (req, res) => {
//   try {
//     const { chatId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(chatId)) {
//       return res.status(400).json({ message: "Invalid chat ID format" });
//     }

//     const chat = await Chat.findById(chatId).populate(
//       "assignedTo",
//       "fullName email department"
//     );
//     if (!chat) return res.status(404).json({ message: "Chat not found" });

//     res.status(200).json({
//       message: "Chat fetched successfully",
//       data: chat,
//     });
//   } catch (err) {
//     console.error("Error in getChatById:", err);
//     res
//       .status(500)
//       .json({ message: "Error fetching chat", error: err.message });
//   }
// };

// exports.markChatResolved = async (req, res) => {
//   try {
//     const { chatId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(chatId)) {
//       return res.status(400).json({ message: "Invalid chat ID format" });
//     }

//     const chat = await Chat.findByIdAndUpdate(
//       chatId,
//       { status: "resolved" },
//       { new: true }
//     ).populate("assignedTo", "fullName email department");

//     if (!chat) {
//       return res.status(404).json({ message: "Chat not found" });
//     }

//     res.status(200).json({ message: "Chat marked as resolved", data: chat });
//   } catch (err) {
//     console.error("Error in markChatResolved:", err);
//     res
//       .status(500)
//       .json({ message: "Failed to mark chat as resolved", error: err.message });
//   }
// };
