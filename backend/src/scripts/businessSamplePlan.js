import {
  addBusinessCalendarDays,
  businessMidnightUtc,
  getBusinessDateParts,
} from "../utils/businessTime.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_WEEKS = 52;
const PRICE_OBSERVATIONS = 53;
const CUSTOMER_RECORDS = [
  [
    "Synthetic Workshop Customer - Ampara Auto Works",
    "077 000 1001",
    "Ampara",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Eastern Wheel Care",
    "077 000 1002",
    "Sammanthurai",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Kalmunai Motor Clinic",
    "077 000 1003",
    "Kalmunai",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - New Town Motorcycle Service",
    "077 000 1004",
    "Akkaraipattu",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Coastal Two Wheeler Centre",
    "077 000 1005",
    "Sainthamaruthu",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Nintavur Bike Care",
    "077 000 1006",
    "Nintavur",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Lake Road Garage",
    "077 000 1007",
    "Ampara",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Sunrise Motorcycle Repairs",
    "077 000 1008",
    "Sammanthurai",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Central Cycle and Motor",
    "077 000 1009",
    "Kalmunai",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Akkaraipattu Service Point",
    "077 000 1010",
    "Akkaraipattu",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Eastern Commuter Garage",
    "077 000 1011",
    "Sainthamaruthu",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Greenfield Motor Repairs",
    "077 000 1012",
    "Nintavur",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Sammanthurai Commuter Service",
    "077 000 1013",
    "Sammanthurai",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Ampara Roadside Garage",
    "077 000 1014",
    "Ampara",
    "Workshop",
  ],
  [
    "Synthetic Workshop Customer - Kalmunai Two-Wheelers",
    "077 000 1015",
    "Kalmunai",
    "Workshop",
  ],
  [
    "Synthetic Individual Customer - Kavitha Rajan",
    "077 000 1016",
    "Akkaraipattu",
    "Individual",
  ],
  [
    "Synthetic Individual Customer - Mohamed Riyas",
    "077 000 1017",
    "Sainthamaruthu",
    "Individual",
  ],
  [
    "Synthetic Individual Customer - Sanduni Fernando",
    "077 000 1018",
    "Nintavur",
    "Individual",
  ],
  [
    "Synthetic Individual Customer - Tharshan Kumar",
    "077 000 1019",
    "Sammanthurai",
    "Individual",
  ],
  [
    "Synthetic Individual Customer - Rizwana Ameen",
    "077 000 1020",
    "Ampara",
    "Individual",
  ],
];

const CATEGORIES = [
  "Yamaha Engine & Ignition Parts",
  "Yamaha Brakes & Drive Parts",
  "Yamaha Electrical & Controls",
];

const SUPPLIERS = [
  {
    name: "Synthetic Lanka Motorcycle Parts Supplier 01",
    contactPerson: "Synthetic Supplier Contact 01",
    phone: "077 000 2001",
    address: "Synthetic commercial address, Colombo",
    city: "Colombo",
    leadTimeDays: 5,
    paymentTerms: "Cash on delivery (synthetic terms)",
  },
  {
    name: "Synthetic Eastern Two-Wheeler Supply 02",
    contactPerson: "Synthetic Supplier Contact 02",
    phone: "077 000 2002",
    address: "Synthetic commercial address, Ampara",
    city: "Ampara",
    leadTimeDays: 3,
    paymentTerms: "Net 14 days (synthetic terms)",
  },
];

const PARTS = [
  ["Yamaha YBR125 spark plug", 0, 0, 650, 900, "Piece", "YBR125, SZ-RR"],
  ["Yamaha FZ-S spark plug", 0, 0, 720, 990, "Piece", "FZ-S, FZ 150"],
  [
    "Yamaha YBR125 air filter element",
    0,
    1,
    1250,
    1650,
    "Piece",
    "YBR125, SZ-RR",
  ],
  ["Yamaha FZ-S air filter element", 0, 1, 1450, 1900, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 oil filter", 0, 0, 850, 1150, "Piece", "YBR125"],
  ["Yamaha FZ-S oil filter", 0, 1, 1050, 1400, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 clutch plate set", 0, 0, 5800, 7600, "Set", "YBR125"],
  ["Yamaha FZ-S clutch plate set", 0, 1, 7200, 9600, "Set", "FZ-S, FZ 150"],
  [
    "Yamaha YBR125 front brake shoe set",
    1,
    0,
    1850,
    2450,
    "Set",
    "YBR125, SZ-RR",
  ],
  ["Yamaha FZ-S front brake pad set", 1, 1, 2350, 3100, "Set", "FZ-S, FZ 150"],
  ["Yamaha YBR125 rear brake shoe set", 1, 0, 1650, 2200, "Set", "YBR125"],
  ["Yamaha FZ-S rear brake shoe set", 1, 1, 2100, 2800, "Set", "FZ-S, FZ 150"],
  ["Yamaha YBR125 drive chain", 1, 0, 4200, 5600, "Piece", "YBR125, SZ-RR"],
  ["Yamaha YBR125 front sprocket", 1, 1, 1550, 2050, "Piece", "YBR125"],
  ["Yamaha YBR125 rear sprocket", 1, 0, 3400, 4500, "Piece", "YBR125"],
  [
    "Yamaha FZ-S drive chain and sprocket kit",
    1,
    1,
    8900,
    11800,
    "Set",
    "FZ-S, FZ 150",
  ],
  ["Yamaha YBR125 clutch cable", 2, 0, 900, 1200, "Piece", "YBR125"],
  ["Yamaha FZ-S clutch cable", 2, 1, 1100, 1450, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 throttle cable", 2, 0, 850, 1150, "Piece", "YBR125"],
  ["Yamaha FZ-S throttle cable", 2, 1, 1050, 1400, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 headlamp bulb", 2, 0, 700, 950, "Piece", "YBR125"],
  ["Yamaha FZ-S headlamp bulb", 2, 1, 950, 1300, "Piece", "FZ-S, FZ 150"],
  [
    "Yamaha YBR125 indicator lamp pair",
    2,
    0,
    1150,
    1550,
    "Pair",
    "YBR125, SZ-RR",
  ],
  ["Yamaha FZ-S indicator lamp pair", 2, 1, 1450, 1950, "Pair", "FZ-S, FZ 150"],
  ["Yamaha YBR125 rectifier regulator", 2, 0, 3200, 4250, "Piece", "YBR125"],
  [
    "Yamaha FZ-S rectifier regulator",
    2,
    1,
    3900,
    5200,
    "Piece",
    "FZ-S, FZ 150",
  ],
  ["Yamaha YBR125 starter relay", 2, 0, 1850, 2450, "Piece", "YBR125"],
  ["Yamaha FZ-S starter relay", 2, 1, 2200, 2950, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 front fork seal pair", 1, 0, 2400, 3200, "Pair", "YBR125"],
  [
    "Yamaha FZ-S front fork seal pair",
    1,
    1,
    2950,
    3950,
    "Pair",
    "FZ-S, FZ 150",
  ],
  ["Yamaha YBR125 wheel bearing set", 1, 0, 1800, 2400, "Set", "YBR125, SZ-RR"],
  ["Yamaha FZ-S wheel bearing set", 1, 1, 2250, 3000, "Set", "FZ-S, FZ 150"],
  ["Yamaha YBR125 engine gasket set", 0, 0, 3600, 4800, "Set", "YBR125"],
  ["Yamaha FZ-S engine gasket set", 0, 1, 4400, 5900, "Set", "FZ-S, FZ 150"],
  ["Yamaha YBR125 piston ring set", 0, 0, 3100, 4150, "Set", "YBR125"],
  ["Yamaha FZ-S piston ring set", 0, 1, 3850, 5150, "Set", "FZ-S, FZ 150"],
  ["Yamaha YBR125 side-stand spring", 2, 0, 450, 620, "Piece", "YBR125, SZ-RR"],
  ["Yamaha FZ-S side-stand spring", 2, 1, 550, 750, "Piece", "FZ-S, FZ 150"],
  ["Yamaha YBR125 handlebar grip pair", 2, 0, 800, 1080, "Pair", "YBR125"],
  ["Yamaha FZ-S handlebar grip pair", 2, 1, 950, 1280, "Pair", "FZ-S, FZ 150"],
];

const EXTRA_MODELS = ["YBR125", "FZ-S", "SZ-RR", "FZ 150", "Saluto"];
const EXTRA_COMPONENTS = [
  ["fuel pump assembly", 0, 4200, 5600, "Piece"],
  ["fuel injector", 0, 3600, 4800, "Piece"],
  ["carburetor repair kit", 0, 1800, 2400, "Kit"],
  ["engine oil pump", 0, 3200, 4300, "Piece"],
  ["timing chain", 0, 2100, 2800, "Piece"],
  ["cam chain tensioner", 0, 1900, 2550, "Piece"],
  ["cylinder head gasket", 0, 950, 1280, "Piece"],
  ["clutch release bearing", 0, 1200, 1600, "Piece"],
  ["rear brake cable", 1, 850, 1150, "Piece"],
  ["front brake cable", 1, 800, 1080, "Piece"],
  ["brake lever assembly", 1, 1450, 1950, "Piece"],
  ["rear sprocket dampers", 1, 1250, 1680, "Set"],
  ["chain adjuster set", 1, 700, 950, "Set"],
  ["front wheel axle", 1, 2200, 2950, "Piece"],
  ["rear wheel axle", 1, 2600, 3500, "Piece"],
  ["speedometer cable", 2, 900, 1220, "Piece"],
  ["ignition coil", 2, 1850, 2500, "Piece"],
  ["starter switch assembly", 2, 1500, 2020, "Piece"],
  ["handlebar switch set", 2, 2400, 3220, "Set"],
  ["battery charging rectifier", 2, 2100, 2820, "Piece"],
];
const EXTRA_PARTS = EXTRA_MODELS.flatMap((model, modelIndex) =>
  EXTRA_COMPONENTS.map(
    ([component, category, cost, price, unit], componentIndex) => {
      const modelScale = 100 + modelIndex * 3;
      return [
        `Yamaha ${model} ${component}`,
        category,
        (modelIndex + componentIndex) % SUPPLIERS.length,
        Math.round((cost * modelScale) / 100),
        Math.round((price * modelScale) / 100),
        unit,
        model,
      ];
    },
  ),
);

export const INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT = PARTS.length;

const PRODUCTS = [...PARTS, ...EXTRA_PARTS].map(
  ([name, category, supplier, cost, price, unit, compatibleModels], index) => ({
    name,
    category,
    supplier,
    cost,
    price,
    unit,
    compatibleModels,
    profile:
      index >= PARTS.length
        ? "slow"
        : index < 8
          ? "fast"
          : index < 20
            ? "regular"
            : index < 32
              ? "medium"
              : "slow",
    minimum: index < 8 ? 12 : index < 20 ? 8 : 5 + (index % 3),
    maximum: index < 8 ? 160 : index < 20 ? 100 : index < 32 ? 70 : 45,
  }),
);

const PURCHASE_ORDER_STATUSES = [
  "received",
  "partially_received",
  "received",
  "cancelled",
  "received",
  "draft",
  "received",
  "partially_received",
  "received",
  "received",
  "draft",
  "ordered",
];

const todayBusinessDate = () => {
  const { year, month, day } = getBusinessDateParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const businessDate = (date, dayOffset = 0, hour = 11) => {
  const parts = getBusinessDateParts(date);
  const day = addBusinessCalendarDays(parts, dayOffset);
  return new Date(
    businessMidnightUtc(day.year, day.month, day.day).getTime() +
      hour * 60 * 60 * 1000,
  );
};

const assertDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("asOf must be an ISO calendar date (YYYY-MM-DD)");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = businessMidnightUtc(year, month, day);
  const parts = getBusinessDateParts(date);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    throw new TypeError("asOf must be a valid calendar date");
  }
  return date;
};

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const productSalesWeeks = (product, productIndex) => {
  if (product.profile === "fast" || product.profile === "regular") {
    return Array.from({ length: HISTORY_WEEKS }, (_, week) => week);
  }
  if (product.profile === "medium") {
    return Array.from({ length: HISTORY_WEEKS }, (_, week) => week).filter(
      (week) => week % 2 === productIndex % 2,
    );
  }
  return Array.from({ length: HISTORY_WEEKS }, (_, week) => week).filter(
    (week) => week % 4 === productIndex % 4,
  );
};

const lastMonthEndOffset = (weekStart) => {
  for (let offset = 6; offset >= 0; offset -= 1) {
    const parts = getBusinessDateParts(
      new Date(weekStart.getTime() + offset * DAY_MS),
    );
    if (parts.day >= 28) return offset;
  }
  return null;
};

const saleDateFor = (firstWeek, week, productIndex) => {
  const weekStart = new Date(firstWeek.getTime() + week * 7 * DAY_MS);
  const monthEndOffset = lastMonthEndOffset(weekStart);
  const isMonthEndEvent =
    monthEndOffset !== null && (week + productIndex) % 4 === 0;
  const weekendOffset = (week + productIndex) % 3 === 0 ? 5 : 6;
  const dayOffset = isMonthEndEvent
    ? monthEndOffset
    : (week + productIndex) % 5 === 0
      ? 3
      : weekendOffset;
  return businessDate(weekStart, dayOffset, 11 + ((week + productIndex) % 7));
};

const quantityFor = (product, week, productIndex, saleDate) => {
  let quantity =
    product.profile === "fast"
      ? 11 + ((week + productIndex) % 5)
      : product.profile === "regular"
        ? 1
        : 1;
  const parts = getBusinessDateParts(saleDate);
  const weekday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  if ((weekday === 0 || weekday === 6) && (week + productIndex) % 4 === 0) {
    quantity += product.profile === "fast" ? 2 : 1;
  }
  if (parts.day >= 28 && (week + productIndex) % 4 === 1) {
    quantity += product.profile === "fast" ? 2 : 1;
  }
  if (parts.month === 4) quantity = Math.ceil(quantity * 1.25);
  if (parts.month === 12) quantity = Math.ceil(quantity * 1.2);
  return quantity;
};

const dateKey = (date) => {
  const { year, month, day } = getBusinessDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const makeSalesInvoices = (asOf) => {
  const { year, month, day } = getBusinessDateParts(asOf);
  const currentWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (currentWeekday + 6) % 7;
  const currentWeekStart = businessDate(asOf, -daysSinceMonday, 0);
  const firstWeek = new Date(
    currentWeekStart.getTime() - HISTORY_WEEKS * 7 * DAY_MS,
  );
  const invoicesByDate = new Map();

  PRODUCTS.forEach((product, productIndex) => {
    if (productIndex >= PARTS.length) return;
    for (const week of productSalesWeeks(product, productIndex)) {
      const saleDate = saleDateFor(firstWeek, week, productIndex);
      const key = `invoice-${dateKey(saleDate)}`;
      const invoice = invoicesByDate.get(key) || {
        key,
        invoiceNumber: `SYNTH-INVOICE-${dateKey(saleDate).replace(/-/g, "")}`,
        historyWeek: week,
        customerIndex: (week * 7 + productIndex) % CUSTOMER_RECORDS.length,
        saleDate,
        items: [],
      };
      invoice.items.push({
        productIndex,
        quantity: quantityFor(product, week, productIndex, saleDate),
        unitPrice: roundMoney(
          product.price * (1 + (((week + productIndex) % 5) - 2) * 0.004),
        ),
      });
      invoicesByDate.set(key, invoice);
    }
  });

  const currentInvoice = {
    key: "invoice-current-day",
    invoiceNumber: "SYNTH-INVOICE-CURRENT-DAY",
    historyWeek: null,
    customerIndex: CUSTOMER_RECORDS.length - 1,
    saleDate: businessDate(asOf, 0, 10),
    items: PRODUCTS.slice(0, 8).map((product, productIndex) => ({
      productIndex,
      quantity: 1,
      unitPrice: product.price,
    })),
  };
  return [
    ...[...invoicesByDate.values()].sort(
      (left, right) => left.saleDate - right.saleDate,
    ),
    currentInvoice,
  ];
};

const makePurchaseOrders = (asOf, datasetId) => {
  const orderDaysAgo = [350, 320, 290, 260, 230, 200, 170, 140, 110, 80, 40, 4];
  return PURCHASE_ORDER_STATUSES.map((status, orderIndex) => {
    const items = [];
    for (let productIndex = 0; productIndex < 8; productIndex += 1) {
      items.push({
        productIndex,
        quantity: 100 + ((orderIndex + productIndex) % 4) * 5,
      });
    }
    for (let itemIndex = 0; itemIndex < 4; itemIndex += 1) {
      const productIndex = 8 + ((orderIndex * 3 + itemIndex * 5) % 28);
      const quantity =
        productIndex < 20
          ? 30 + ((orderIndex + itemIndex) % 4) * 5
          : productIndex < 32
            ? 18 + ((orderIndex + itemIndex) % 4) * 3
            : 10 + ((orderIndex + itemIndex) % 4) * 2;
      items.push({
        productIndex,
        quantity,
      });
    }
    const safeId = datasetId
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(-8)
      .toUpperCase();
    const supplierIndex = orderIndex % SUPPLIERS.length;
    return {
      key: `purchase-order-${String(orderIndex + 1).padStart(2, "0")}`,
      status,
      items,
      supplierIndex,
      supplierCode: `SMP-${safeId.slice(-6)}-${String(supplierIndex + 1).padStart(2, "0")}`,
      poNumber: `SYNTH-${safeId}-PO-${String(orderIndex + 1).padStart(3, "0")}`,
      orderDate: businessDate(asOf, -orderDaysAgo[orderIndex]),
      expectedDeliveryDate: businessDate(
        asOf,
        -orderDaysAgo[orderIndex] + SUPPLIERS[supplierIndex].leadTimeDays,
      ),
    };
  });
};

const makePurchaseReceipts = (asOf, purchaseOrders) =>
  purchaseOrders.flatMap((order, orderIndex) => {
    if (!["received", "partially_received"].includes(order.status)) return [];
    const receiptDate = businessDate(
      order.orderDate,
      SUPPLIERS[order.supplierIndex].leadTimeDays,
    );
    const boundedDate = receiptDate > asOf ? asOf : receiptDate;
    return [
      {
        orderIndex,
        key: "receipt-1",
        date: boundedDate,
        items: order.items.map((item) => ({
          productIndex: item.productIndex,
          quantity:
            order.status === "received"
              ? item.quantity
              : Math.max(1, Math.floor(item.quantity * 0.65)),
        })),
      },
    ];
  });

const makeMarketPrices = (asOf) =>
  PRODUCTS.flatMap((product, productIndex) => {
    const trend = [0.08, -0.06, 0.11, -0.04][productIndex % 4];
    return Array.from({ length: PRICE_OBSERVATIONS }, (_, observationIndex) => {
      const dayOffset = -364 + observationIndex * 7;
      const trendPosition = observationIndex / (PRICE_OBSERVATIONS - 1);
      const variation = (((observationIndex + productIndex) % 5) - 2) * 0.004;
      return {
        productIndex,
        key: `price-${String(productIndex + 1).padStart(2, "0")}-${String(observationIndex + 1).padStart(2, "0")}`,
        price: roundMoney(
          product.price * (1 + trend * trendPosition + variation),
        ),
        sourceIndex: productIndex % SUPPLIERS.length,
        priceType: "Retail",
        recordedAt: businessDate(asOf, dayOffset, 12),
      };
    });
  });

const makeOpeningQuantities = (salesInvoices, purchaseReceipts) => {
  const salesByProduct = Array(PRODUCTS.length).fill(0);
  const receiptsByProduct = Array(PRODUCTS.length).fill(0);
  const eventsByProduct = PRODUCTS.map(() => []);
  salesInvoices.forEach((invoice) =>
    invoice.items.forEach((item) => {
      salesByProduct[item.productIndex] += item.quantity;
      eventsByProduct[item.productIndex].push({
        date: invoice.saleDate,
        delta: -item.quantity,
      });
    }),
  );
  purchaseReceipts.forEach((receipt) =>
    receipt.items.forEach((item) => {
      receiptsByProduct[item.productIndex] += item.quantity;
      eventsByProduct[item.productIndex].push({
        date: receipt.date,
        delta: item.quantity,
      });
    }),
  );
  const openingQuantities = [];
  const expectedEndingStocks = [];
  PRODUCTS.forEach((product, productIndex) => {
    const events = eventsByProduct[productIndex].sort(
      (left, right) => left.date - right.date,
    );
    let running = 0;
    let maximumDeficit = 0;
    events.forEach(({ delta }) => {
      running += delta;
      maximumDeficit = Math.max(maximumDeficit, -running);
    });
    const desiredEndingStock =
      productIndex >= 36
        ? productIndex - 35
        : product.minimum + 8 + (productIndex % 5);
    const openingQuantity = Math.max(
      maximumDeficit,
      salesByProduct[productIndex] -
        receiptsByProduct[productIndex] +
        desiredEndingStock,
      1,
    );
    openingQuantities.push(openingQuantity);
    expectedEndingStocks.push(
      openingQuantity +
        receiptsByProduct[productIndex] -
        salesByProduct[productIndex],
    );
  });
  return { openingQuantities, expectedEndingStocks };
};

const ean13Barcode = (sequence) => {
  const body = `200${String(sequence).padStart(9, "0")}`.slice(-12);
  const weightedSum = [...body].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${body}${(10 - (weightedSum % 10)) % 10}`;
};

export const buildBusinessSamplePlan = ({
  asOf = todayBusinessDate(),
  datasetId = "ahs-yamaha-synthetic-v2",
} = {}) => {
  if (
    typeof datasetId !== "string" ||
    !/^[A-Za-z0-9._-]{3,48}$/.test(datasetId)
  ) {
    throw new TypeError(
      "datasetId must contain 3 to 48 letters, digits, dots, underscores, or hyphens",
    );
  }
  const anchor = assertDateOnly(asOf);
  const salesInvoices = makeSalesInvoices(anchor);
  const purchaseOrders = makePurchaseOrders(anchor, datasetId);
  const purchaseReceipts = makePurchaseReceipts(anchor, purchaseOrders);
  const marketPrices = makeMarketPrices(anchor);
  const { openingQuantities, expectedEndingStocks } = makeOpeningQuantities(
    salesInvoices,
    purchaseReceipts,
  );
  const idSuffix = datasetId
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  const shortSuffix = idSuffix.slice(-6);
  const products = PRODUCTS.map((product, index) => {
    return {
      ...product,
      key: `product-${String(index + 1).padStart(2, "0")}`,
      sku: `YSP-${idSuffix}-${String(index + 1).padStart(3, "0")}`,
      barcode: ean13Barcode(index + 1),
      openingQuantity: openingQuantities[index],
      expectedEndingStock: expectedEndingStocks[index],
      openingDate: businessDate(anchor, -364),
      categoryName: CATEGORIES[product.category],
      supplierCode: `SMP-${shortSuffix}-${String(product.supplier + 1).padStart(2, "0")}`,
      createdAt: businessDate(anchor, -364),
    };
  });
  return {
    datasetId,
    asOf,
    categories: CATEGORIES,
    suppliers: SUPPLIERS,
    customers: CUSTOMER_RECORDS.map(
      ([name, phone, city, customerType], index) => ({
        key: `customer-${String(index + 1).padStart(2, "0")}`,
        name,
        phone,
        address: `Synthetic address, ${city}, Sri Lanka`,
        notes: `Synthetic ${customerType.toLowerCase()} customer; not a verified person or business.`,
        customerType,
      }),
    ),
    products,
    salesInvoices,
    purchaseOrders,
    purchaseReceipts,
    marketPrices,
  };
};

export const validateBusinessSampleLedger = (plan) => {
  const balances = plan.products.map((product) => product.openingQuantity);
  const violations = [];
  const operations = [
    ...plan.salesInvoices.flatMap((invoice) =>
      invoice.items.map((item) => ({
        date: invoice.saleDate,
        kind: "sale",
        item,
      })),
    ),
    ...plan.purchaseReceipts.flatMap((receipt) =>
      receipt.items.map((item) => ({
        date: receipt.date,
        kind: "receipt",
        item,
      })),
    ),
  ].sort(
    (left, right) =>
      left.date - right.date || left.kind.localeCompare(right.kind),
  );
  for (const { kind, item } of operations) {
    balances[item.productIndex] +=
      kind === "receipt" ? item.quantity : -item.quantity;
    if (balances[item.productIndex] < 0)
      violations.push(`Product ${item.productIndex + 1} goes below zero.`);
  }
  plan.products.forEach((product, productIndex) => {
    if (balances[productIndex] !== product.expectedEndingStock) {
      violations.push(
        `Product ${productIndex + 1} ends at ${balances[productIndex]}, expected ${product.expectedEndingStock}.`,
      );
    }
  });
  return {
    valid: violations.length === 0,
    violations,
    balances,
    saleLineCount: plan.salesInvoices.reduce(
      (total, invoice) => total + invoice.items.length,
      0,
    ),
    receiptLineCount: plan.purchaseReceipts.reduce(
      (total, receipt) => total + receipt.items.length,
      0,
    ),
  };
};

export const getBusinessSampleRecordKeys = (
  plan,
  productCount = plan.products.length,
) => {
  const saleKeys = plan.salesInvoices.flatMap((invoice) =>
    invoice.items.map((_, index) => `${invoice.key}:line:${index + 1}`),
  );
  const products = plan.products.slice(0, productCount);
  const openingMovementKeys = products.map(
    (product) => `${product.key}:opening`,
  );
  const receiptMovementKeys = plan.purchaseReceipts.flatMap((receipt) =>
    receipt.items.map(
      (_, index) =>
        `${plan.purchaseOrders[receipt.orderIndex].key}:${receipt.key}:line:${index + 1}`,
    ),
  );
  const marketPrices = plan.marketPrices
    .filter((record) => record.productIndex < productCount)
    .map((record) => record.key);
  return {
    Category: plan.categories.map(
      (_, index) => `category-${String(index + 1).padStart(2, "0")}`,
    ),
    Supplier: plan.suppliers.map(
      (_, index) => `supplier-${String(index + 1).padStart(2, "0")}`,
    ),
    Customer: plan.customers.map((customer) => customer.key),
    Product: products.map((product) => product.key),
    PurchaseOrder: plan.purchaseOrders.map((order) => order.key),
    Sale: saleKeys,
    StockMovement: [
      ...openingMovementKeys,
      ...saleKeys,
      ...receiptMovementKeys,
    ],
    MarketPrice: marketPrices,
  };
};

export const summarizeBusinessSamplePlan = (plan) => {
  const keys = getBusinessSampleRecordKeys(plan);
  return {
    datasetId: plan.datasetId,
    asOf: plan.asOf,
    categories: keys.Category.length,
    suppliers: keys.Supplier.length,
    customers: keys.Customer.length,
    products: keys.Product.length,
    purchaseOrders: keys.PurchaseOrder.length,
    purchaseOrderStatuses: Object.fromEntries(
      ["draft", "ordered", "partially_received", "received", "cancelled"].map(
        (status) => [
          status,
          plan.purchaseOrders.filter((order) => order.status === status).length,
        ],
      ),
    ),
    salesInvoices: plan.salesInvoices.length,
    saleLines: keys.Sale.length,
    stockMovements: keys.StockMovement.length,
    marketPriceObservations: keys.MarketPrice.length,
    totalDocuments: Object.values(keys).reduce(
      (total, items) => total + items.length,
      0,
    ),
  };
};
