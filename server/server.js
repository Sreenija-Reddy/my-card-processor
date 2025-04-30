const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parseString } = require('xml2js');
const cors = require('cors');
const { XMLParser } = require('fast-xml-parser'); // Add fast-xml-parser for XML parsing

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration - using absolute paths
const PROJECT_ROOT = path.join(__dirname, '../');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const STORAGE_FILE = path.join(__dirname, 'storage', 'transactions.json');

// Create required directories if they don't exist
[UPLOAD_DIR, path.dirname(STORAGE_FILE), DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

// Data storage
let transactions = [];
let rejectedTransactions = [];

// Helper functions
const getCardType = (cardNumber) => {
  if (!cardNumber) return 'Invalid';
  const firstDigit = cardNumber.toString().charAt(0);
  const cardTypes = {
    '3': 'American Express',
    '4': 'Visa',
    '5': 'MasterCard',
    '6': 'Discover',
  };
  return cardTypes[firstDigit] || 'Invalid';
};

const validateCardNumber = (cardNumber) => {
  if (!cardNumber) return false;
  const cleanNumber = cardNumber.toString().replace(/\D/g, '');
  return (
    cleanNumber.length >= 13 &&
    cleanNumber.length <= 16 &&
    ['3', '4', '5', '6'].includes(cleanNumber.charAt(0))
  );
};

const processTransaction = (cardNumber, amount, timestamp) => {
  const cleanNumber = cardNumber.toString().replace(/\D/g, '');
  const cardType = getCardType(cleanNumber);
  const amountNum = parseFloat(amount);
  const transactionTime = timestamp ? new Date(timestamp) : new Date();

  if (!validateCardNumber(cleanNumber)) {
    rejectedTransactions.push({
      cardNumber: cleanNumber,
      amount: amountNum || amount,
      reason: 'Invalid card number',
      timestamp: transactionTime.toISOString(),
    });
    return false;
  }

  if (isNaN(amountNum) || amountNum <= 0) {
    rejectedTransactions.push({
      cardNumber: cleanNumber,
      amount: amount,
      reason: 'Invalid amount',
      timestamp: transactionTime.toISOString(),
    });
    return false;
  }

  transactions.push({
    cardNumber: cleanNumber,
    amount: amountNum,
    cardType,
    timestamp: transactionTime.toISOString(),
  });
  return true;
};

const saveToFile = () => {
  const data = { transactions, rejectedTransactions };
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
};

// File upload configuration
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const filetypes = /csv|json|xml/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    cb(null, extname && mimetype);
  },
});

// Load initial data
function loadInitialData() {
  // Load from storage file if exists
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      transactions = data.transactions || [];
      rejectedTransactions = data.rejectedTransactions || [];
      console.log(`Loaded ${transactions.length} transactions from storage`);
    } catch (err) {
      console.error('Error loading transaction data:', err);
    }
  }

  // Load from data directory if it exists
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      if (files.length === 0) {
        console.log(`Data directory is empty: ${DATA_DIR}`);
      } else {
        console.log(`Processing ${files.length} files from data directory`);
        files.forEach((file) => {
          const filePath = path.join(DATA_DIR, file);
          processFile(filePath);
        });
      }
    } else {
      console.log(`Data directory not found at ${DATA_DIR}. Skipping initial data load.`);
    }
  } catch (err) {
    console.error('Error loading initial data:', err);
  }
}

function processFile(filePath) {
  const fileExt = path.extname(filePath).toLowerCase();
  console.log(`Processing file: ${filePath}`);

  try {
    if (fileExt === '.csv') {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) =>
          processTransaction(row.cardNumber || row.card, row.amount, row.timestamp)
        )
        .on('error', (err) => console.error(`Error processing CSV: ${err}`));
    } else if (fileExt === '.json') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) {
        data.forEach((item) =>
          processTransaction(item.cardNumber || item.card, item.amount, item.timestamp)
        );
      }
    } else if (fileExt === '.xml') {
      const xmlData = fs.readFileSync(filePath, 'utf8');
      parseString(xmlData, (err, result) => {
        if (err) throw err;
        const items = result.transactions?.transaction || [];
        items.forEach((item) =>
          processTransaction(
            item.cardNumber?.[0] || item.card?.[0],
            item.amount?.[0],
            item.timestamp?.[0]
          )
        );
      });
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

// API Endpoints
app.post('/api/transactions', (req, res) => {
  try {
    const { cardNumber, amount } = req.body;

    if (!cardNumber || !amount) {
      return res.status(400).json({ error: 'Card number and amount are required' });
    }

    const success = processTransaction(cardNumber, amount);

    if (success) {
      saveToFile();
      const transaction = transactions[transactions.length - 1];
      res.json({
        cardNumber: transaction.cardNumber,
        amount: transaction.amount,
        cardType: transaction.cardType,
      });
    } else {
      saveToFile();
      res.status(400).json({
        error: 'Transaction rejected',
        details: rejectedTransactions[rejectedTransactions.length - 1],
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/process-files', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    let processed = 0;
    let rejected = 0;
    const errors = [];

    for (const file of req.files) {
      const filePath = path.join(UPLOAD_DIR, file.filename);
      try {
        const fileExt = path.extname(file.originalname).toLowerCase();

        // CSV processing
        if (fileExt === '.csv') {
          await new Promise((resolve) => {
            fs.createReadStream(filePath)
              .pipe(csv())
              .on('data', (row) => {
                if (processTransaction(row.cardNumber, row.amount, row.timestamp)) processed++;
                else rejected++;
              })
              .on('end', resolve)
              .on('error', (err) => {
                errors.push(`CSV processing error: ${err.message}`);
                resolve();
              });
          });
        }

        // JSON processing
        else if (fileExt === '.json') {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            data.forEach((entry) => {
              if (processTransaction(entry.cardNumber, entry.amount, entry.timestamp)) processed++;
              else rejected++;
            });
          } else {
            errors.push(`Invalid JSON structure in ${file.originalname}`);
          }
        }

        // XML processing
        else if (fileExt === '.xml') {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parser = new XMLParser();
          const xml = parser.parse(content);

          const transactions = xml.transactions?.transaction || [];
          const txList = Array.isArray(transactions) ? transactions : [transactions];

          txList.forEach((entry) => {
            if (processTransaction(entry.cardNumber, entry.amount, entry.timestamp)) processed++;
            else rejected++;
          });
        }

        else {
          errors.push(`Unsupported file format: ${file.originalname}`);
          rejected++;
        }

      } catch (err) {
        errors.push(`Error processing ${file.originalname}: ${err.message}`);
        rejected++;
      } finally {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {}
      }
    }

    saveToFile();
    res.json({
      success: true,
      processed,
      rejected,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/summary', (req, res) => {
  try {
    res.json({
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      byCardType: transactions.reduce((acc, t) => {
        acc[t.cardType] = (acc[t.cardType] || 0) + 1;
        return acc;
      }, {}),
      byDate: transactions.reduce((acc, t) => {
        const date = t.timestamp.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}),
      rejectedCount: rejectedTransactions.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/rejected', (req, res) => {
  try {
    res.json(rejectedTransactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
loadInitialData();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Storage file: ${STORAGE_FILE}`);
});
