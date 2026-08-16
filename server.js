const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

const RATES = {
    bw_single: 5,
    color: 10
};

let orders = [];
let tokenCounter = 101;

app.post('/api/upload-and-calculate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'फाइल अपलोड नहीं हुई' });
        
        const printType = req.body.printType || 'bw_single';
        const copies = parseInt(req.body.copies) || 1;
        let totalPages = 1;

        if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const dataBuffer = fs.readFileSync(req.file.path);
                const pdfData = await pdfParse(dataBuffer);
                totalPages = pdfData.numpages || 1;
            } catch (e) { totalPages = 1; }
        }

        let rate = RATES[printType] || 5;
        res.json({
            success: true,
            fileId: req.file.filename,
            originalName: req.file.originalname,
            totalPages: totalPages,
            totalAmount: totalPages * rate * copies,
            printType,
            copies
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'सर्वर एरर' });
    }
});

app.post('/api/confirm-order', (req, res) => {
    const newOrder = {
        tokenNo: tokenCounter++,
        ...req.body,
        createdAt: new Date().toLocaleTimeString()
    };
    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

app.get('/api/admin/orders', (req, res) => res.json(orders));

app.listen(process.env.PORT || 3000, () => console.log('Server Running'));
