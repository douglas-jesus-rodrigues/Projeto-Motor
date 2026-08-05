const multer = require("multer");
const path = require("path");

// Configuração de armazenamento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Pasta onde as imagens dos veículos serão salvas
        cb(null, path.join(__dirname, "../public/uploads"));
    },
    filename: function (req, file, cb) {
        // Gera um nome único baseado na data atual + nome original para evitar duplicidade
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

module.exports = upload;