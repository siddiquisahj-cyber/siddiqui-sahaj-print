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

// अपलोड फोल्डर सेटअप
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

// रेट लिस्ट
const RATES = {
    bw_single: 5,
    color: 10
};

let orders = [];
let tokenCounter = 101;

// बैकअप PDF पेज गिनने का फंक्शन
function countPdfPagesFallback(buffer) {
    try {
        const text = buffer.toString('binary');
        const matches = text.match(/\/Type\s*\/Page\b/g);
        if (matches && matches.length > 0) {
            return matches.length;
        }
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch && countMatch[1]) {
            return parseInt(countMatch[1], 10);
        }
    } catch (e) {
        console.log("Fallback error");
    }
    return 1;
}

// 1. फाइल अपलोड और पेज काउंट API
app.post('/api/upload-and-calculate', upload.single('document'), async function (req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'फाइल नहीं मिली' });
        }

        const printType = req.body.printType || 'bw_single';
        const copies = parseInt(req.body.copies) || 1;
        let totalPages = 1;

        if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const dataBuffer = fs.readFileSync(req.file.path);
                const pdfData = await pdfParse(dataBuffer);
                if (pdfData && pdfData.numpages) {
                    totalPages = pdfData.numpages;
                } else {
                    totalPages = countPdfPagesFallback(dataBuffer);
                }
            } catch (err) {
                const dataBuffer = fs.readFileSync(req.file.path);
                totalPages = countPdfPagesFallback(dataBuffer);
            }
        }

        const rate = RATES[printType] || 5;
        const totalAmount = totalPages * rate * copies;

        res.json({
            success: true,
            fileId: req.file.filename,
            originalName: req.file.originalname,
            totalPages: totalPages,
            totalAmount: totalAmount,
            printType: printType,
            copies: copies
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'सर्वर एरर' });
    }
});

// 2. ऑर्डर कन्फर्मेशन API
app.post('/api/confirm-order', function (req, res) {
    const newOrder = {
        tokenNo: tokenCounter++,
        customerName: req.body.customerName || 'ग्राहक',
        customerPhone: req.body.customerPhone || '-',
        originalName: req.body.originalName || 'document.pdf',
        fileId: req.body.fileId,
        totalPages: req.body.totalPages || 1,
        totalAmount: req.body.totalAmount || 5,
        printType: req.body.printType || 'bw_single',
        copies: req.body.copies || 1,
        createdAt: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    };
    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

// 3. एडमिन ऑर्डर्स API
app.get('/api/admin/orders', function (req, res) {
    res.json(orders);
});

// 4. फाइल डाउनलोड API
app.get('/api/download/:filename', function (req, res) {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('फाइल नहीं मिली');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log('Server is running on port ' + PORT);
});
