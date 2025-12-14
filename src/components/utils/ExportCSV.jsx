// Utility functions for exporting data to CSV

export const exportToCSV = (data, filename) => {
  const csvContent = data.map(row => row.join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportGroupBuyOrderSummary = (productSummary, groupBuyTitle, discountRules, getDiscountedPrice, getApplicableDiscount) => {
  const hasDiscount = discountRules && discountRules.length > 0;
  const applicableDiscount = hasDiscount ? getApplicableDiscount() : null;
  
  // Build header row
  const headerRow = ['產品名稱'];
  if (hasDiscount) {
    headerRow.push('原價');
    headerRow.push(applicableDiscount ? `折扣價 (${applicableDiscount.discount_percent}% off)` : '折扣價');
  } else {
    headerRow.push('單價');
  }
  headerRow.push('總數量', '訂購明細');
  
  const data = [
    headerRow,
    ...productSummary.map(product => {
      const row = [product.product_name];
      
      if (hasDiscount) {
        row.push(product.price);
        row.push(getDiscountedPrice(product.price));
      } else {
        row.push(product.price);
      }
      
      row.push(product.quantity);
      row.push(product.members.map(m => `${m.name} × ${m.quantity}`).join('、'));
      
      return row;
    })
  ];
  
  exportToCSV(data, `${groupBuyTitle}_訂購彙總_${new Date().toLocaleDateString()}.csv`);
};

export const exportGroupBuyPaymentRecord = (memberSummary, groupBuyTitle, discountRules, getDiscountedPrice) => {
  const hasDiscount = discountRules && discountRules.length > 0;
  
  // Build header row
  const headerRow = ['成員', '產品', '數量'];
  if (hasDiscount) {
    headerRow.push('原價', '折扣價');
  } else {
    headerRow.push('單價');
  }
  headerRow.push('小計', '支付', '小結', '收款');
  
  const data = [headerRow];
  
  // Add rows for each member and their items
  memberSummary.forEach(summary => {
    summary.items.forEach((item, itemIdx) => {
      const row = [];
      
      // Member name (only on first row)
      if (itemIdx === 0) {
        row.push(summary.member_name);
      } else {
        row.push('');
      }
      
      // Product details
      const displayNote = item.note && item.note.includes('平分') ? ` (${item.note})` : '';
      row.push(item.product_name + displayNote);
      
      // Quantity - show '-' for split members who aren't orderers
      const isSplitItem = item.note && item.note.includes('平分');
      const isOrderer = item.note && item.note.includes(`${item.member_name}訂購`);
      if (isSplitItem && !isOrderer) {
        row.push('-');
      } else {
        row.push(item.quantity);
      }
      
      // Price columns
      row.push(item.price);
      if (hasDiscount) {
        row.push(getDiscountedPrice(item.price));
      }
      
      // Subtotal
      const discountedPrice = hasDiscount ? getDiscountedPrice(item.price) : item.price;
      row.push(discountedPrice * item.quantity);
      
      // Payment method (only on first row)
      if (itemIdx === 0) {
        const paymentMethod = item.payment_method === 'rcpay' ? 'RC Pay' :
                             item.payment_method === 'linepay' ? 'Line Pay' :
                             item.payment_method === 'ipasspay' ? 'iPASS Pay' :
                             item.payment_method === 'cash' ? '現金' : '';
        row.push(paymentMethod);
      } else {
        row.push('');
      }
      
      // Total (only on first row)
      if (itemIdx === 0) {
        row.push(summary.total);
      } else {
        row.push('');
      }
      
      // Payment status (only on first row)
      if (itemIdx === 0) {
        row.push(summary.paid ? '已付款' : '未付款');
      } else {
        row.push('');
      }
      
      data.push(row);
    });
  });
  
  exportToCSV(data, `${groupBuyTitle}_收款紀錄_${new Date().toLocaleDateString()}.csv`);
};

export const exportMemberTransactions = (transactions, memberName) => {
  const data = [
    ['日期', '類型', '金額', '錢包類型', '說明'],
    ...transactions.map(t => {
      let type = '';
      let description = '';
      
      if (t.type === 'deposit') {
        type = '入帳';
        description = `入帳至 ${t.to_member_name}`;
      } else if (t.type === 'withdraw') {
        type = '出帳';
        description = `從 ${t.from_member_name} 出帳`;
      } else if (t.type === 'transfer') {
        type = '轉帳';
        description = `${t.from_member_name} → ${t.to_member_name}`;
      }
      
      return [
        new Date(t.created_date).toLocaleString('zh-TW'),
        type,
        t.amount,
        t.wallet_type === 'cash' ? '現金' : '餘額',
        t.note || description
      ];
    })
  ];
  
  exportToCSV(data, `${memberName}_交易明細_${new Date().toLocaleDateString()}.csv`);
};

export const exportMemberGroupBuys = (groupBuys, memberName) => {
  const data = [
    ['團購名稱', '狀態', '產品', '數量', '單價', '小計'],
    ...groupBuys.flatMap(gb => 
      gb.items.map(item => [
        gb.group_buy_title,
        gb.group_buy_status === 'open' ? '進行中' : 
        gb.group_buy_status === 'closed' ? '已截止' : '已結單',
        item.product_name,
        item.quantity,
        item.price,
        item.price * item.quantity
      ])
    )
  ];
  
  exportToCSV(data, `${memberName}_團購紀錄_${new Date().toLocaleDateString()}.csv`);
};

export const exportMemberSummary = (member, transactions, groupBuys, organizedGroupBuys) => {
  const totalDeposit = transactions
    .filter(t => t.type === 'deposit' && t.to_member_id === member.id)
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalWithdraw = transactions
    .filter(t => t.type === 'withdraw' && t.from_member_id === member.id)
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalGroupBuySpent = groupBuys.reduce((sum, gb) => sum + gb.total, 0);
  
  const data = [
    ['成員資訊'],
    ['姓名', member.name],
    ['錢包餘額', member.balance || 0],
    ['現金餘額', member.cash_balance || 0],
    [''],
    ['交易統計'],
    ['總入帳', totalDeposit],
    ['總出帳', totalWithdraw],
    ['團購消費', totalGroupBuySpent],
    [''],
    ['團購統計'],
    ['開團數量', organizedGroupBuys.length],
    ['跟團數量', groupBuys.length]
  ];
  
  exportToCSV(data, `${member.name}_成員報表_${new Date().toLocaleDateString()}.csv`);
};