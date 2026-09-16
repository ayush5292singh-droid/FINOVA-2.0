/* =========================================================
   FINANCE MANAGER MAX
   Local-first finance application
========================================================= */

const KEY = "finance_manager_max_v2";

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Education",
  "Health",
  "Entertainment",
  "Travel",
  "Subscriptions",
  "Home",
  "Salary",
  "Business",
  "Gift",
  "Other"
];

const icons = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍",
  Bills: "🧾",
  Education: "📚",
  Health: "❤️",
  Entertainment: "🎮",
  Travel: "✈️",
  Subscriptions: "🔄",
  Home: "🏠",
  Salary: "💼",
  Business: "💼",
  Gift: "🎁",
  Other: "●"
};

let state = loadState();

let transactionType = "expense";

let cashflowChart = null;
let categoryChart = null;
let analyticsCashChart = null;
let analyticsCategoryChart = null;

const today = new Date();

function uid() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2,8);
}

function localDate() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0,7);
}

function money(value) {

  const currency = state.settings.currency || "INR";

  const symbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
  };

  return symbols[currency] +
    Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });
}

function loadState() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(KEY)
    );

    if (saved) return saved;

  } catch(e) {}

  return {
    transactions: [],
    accounts: [
      {
        id: uid(),
        name: "Cash",
        type: "Cash",
        opening: 0
      }
    ],
    budgets: [],
    goals: [],
    recurring: [],
    bills: [],
    settings: {
      currency: "INR",
      theme: "dark"
    },
    premium: {
      active: false,
      plan: null,
      expiresAt: null
    }
  };
}

function saveState() {

  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );

  refreshEverything();
}

function toast(message) {

  const el = document.getElementById("toast");

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(page) {

  document.querySelectorAll(".page")
    .forEach(p => p.classList.remove("active"));

  const target =
    document.getElementById("page-" + page);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn")
    .forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.page === page
      );
    });

  document.querySelectorAll(".mobile-nav button")
    .forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.page === page
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (page === "analytics") renderAnalytics();
  if (page === "reports") renderReport();
  if (page === "insights") renderInsights();
  if (page === "calendar") renderCalendarDay();
}


/* =========================================================
   DASHBOARD CALCULATIONS
========================================================= */

function totalIncome() {

  return state.transactions
    .filter(t => t.type === "income")
    .reduce((sum,t) => sum + Number(t.amount),0);
}

function totalExpense() {

  return state.transactions
    .filter(t => t.type === "expense")
    .reduce((sum,t) => sum + Number(t.amount),0);
}

function monthlyIncome() {

  const m = monthKey();

  return state.transactions
    .filter(t => t.type === "income" && t.date.startsWith(m))
    .reduce((sum,t) => sum + Number(t.amount),0);
}

function monthlyExpense() {

  const m = monthKey();

  return state.transactions
    .filter(t => t.type === "expense" && t.date.startsWith(m))
    .reduce((sum,t) => sum + Number(t.amount),0);
}

function totalBalance() {

  const opening = state.accounts
    .reduce((sum,a) => sum + Number(a.opening || 0),0);

  return opening + totalIncome() - totalExpense();
}

function accountBalance(id) {

  const account = state.accounts.find(
    a => a.id === id
  );

  if (!account) return 0;

  let value = Number(account.opening || 0);

  state.transactions.forEach(t => {

    if (t.accountId !== id) return;

    if (t.type === "income")
      value += Number(t.amount);

    else
      value -= Number(t.amount);

  });

  return value;
}


/* =========================================================
   REFRESH
========================================================= */

function refreshEverything() {

  applyTheme();

  renderDashboard();
  renderTransactions();
  renderAccounts();
  renderBudgets();
  renderGoals();
  renderRecurring();
  renderBills();
  renderInsights();

  populateSelectors();

  document.getElementById("dashBalance").textContent =
    money(totalBalance());

  document.getElementById("dashIncome").textContent =
    money(monthlyIncome());

  document.getElementById("dashExpense").textContent =
    money(monthlyExpense());

  const saving = monthlyIncome() - monthlyExpense();

  document.getElementById("dashSavings").textContent =
    money(saving);

  const rate = monthlyIncome()
    ? Math.round((saving / monthlyIncome()) * 100)
    : 0;

  document.getElementById("savingRate").textContent =
    rate + "% saving rate";

  document.getElementById("accountTotal").textContent =
    money(totalBalance());

  updateDashboardCharts();
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const list =
    document.getElementById("recentTransactions");

  const recent = [...state.transactions]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0,5);

  if (!recent.length) {

    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◎</div>
        No transactions yet.
      </div>
    `;

  } else {

    list.innerHTML = recent
      .map(transactionHTML)
      .join("");

  }

  renderDashboardBudgets();
}

function transactionHTML(t, compact=false) {

  const sign =
    t.type === "income" ? "+" : "-";

  const account =
    state.accounts.find(a => a.id === t.accountId);

  return `
    <div class="transaction-row">

      <div class="tx-icon">
        ${icons[t.category] || "●"}
      </div>

      <div class="tx-info">
        <b>${escapeHTML(t.note || t.category)}</b>
        <small>
          ${escapeHTML(t.category)}
          • ${formatDate(t.date)}
        </small>
      </div>

      <div class="tx-account">
        ${account ? escapeHTML(account.name) : ""}
      </div>

      <div class="tx-amount ${t.type}">
        ${sign}${money(t.amount)}
      </div>

      ${
        compact ? "" :
        `
        <div class="tx-actions">
          <button class="small-btn"
            onclick="editTransaction('${t.id}')">
            Edit
          </button>

          <button class="small-btn"
            onclick="deleteTransaction('${t.id}')">
            Delete
          </button>
        </div>
        `
      }

    </div>
  `;
}

function renderDashboardBudgets() {

  const box =
    document.getElementById("dashboardBudgets");

  if (!state.budgets.length) {

    box.innerHTML = `
      <div class="empty">
        No budgets created.
      </div>
    `;

    return;
  }

  box.innerHTML =
    state.budgets.slice(0,4)
      .map(budgetHTML)
      .join("");
}


/* =========================================================
   TRANSACTIONS
========================================================= */

function renderTransactions() {

  const list =
    document.getElementById("transactionsList");

  if (!list) return;

  const search =
    (document.getElementById("transactionSearch")?.value || "")
      .toLowerCase();

  const type =
    document.getElementById("transactionType")?.value || "all";

  const category =
    document.getElementById("transactionCategory")?.value || "all";

  const month =
    document.getElementById("transactionMonth")?.value || "";

  let data = [...state.transactions];

  if (search) {

    data = data.filter(t =>
      `${t.note} ${t.category} ${t.tags}`
        .toLowerCase()
        .includes(search)
    );

  }

  if (type !== "all")
    data = data.filter(t => t.type === type);

  if (category !== "all")
    data = data.filter(t => t.category === category);

  if (month)
    data = data.filter(t => t.date.startsWith(month));

  data.sort((a,b) =>
    b.date.localeCompare(a.date)
  );

  if (!data.length) {

    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◎</div>
        No matching transactions.
      </div>
    `;

    return;
  }

  list.innerHTML =
    data.map(t => transactionHTML(t)).join("");
}

function setTransactionType(type) {

  transactionType = type;

  document
    .getElementById("expenseTypeBtn")
    .classList.toggle(
      "selected",
      type === "expense"
    );

  document
    .getElementById("incomeTypeBtn")
    .classList.toggle(
      "selected",
      type === "income"
    );

  populateTransactionCategories();
}

function resetTransactionForm() {

  document.getElementById("transactionForm").reset();

  document.getElementById("editTransactionId").value = "";

  document.getElementById("transactionDate").value =
    localDate();

  setTransactionType("expense");
}

document.getElementById("transactionForm")
  .addEventListener("submit", function(e) {

    e.preventDefault();

    const amount =
      Number(document.getElementById("transactionAmount").value);

    if (!amount || amount <= 0) {

      toast("Enter a valid amount.");
      return;
    }

    const id =
      document.getElementById("editTransactionId").value;

    const item = {

      id: id || uid(),

      type: transactionType,

      amount,

      category:
        document.getElementById("transactionCategoryInput").value,

      accountId:
        document.getElementById("transactionAccount").value,

      date:
        document.getElementById("transactionDate").value,

      method:
        document.getElementById("paymentMethod").value,

      note:
        document.getElementById("transactionNote").value.trim(),

      tags:
        document.getElementById("transactionTags").value.trim()

    };

    if (id) {

      const index =
        state.transactions.findIndex(t => t.id === id);

      if (index >= 0)
        state.transactions[index] = item;

      toast("Transaction updated.");

    } else {

      state.transactions.push(item);

      toast("Transaction saved.");

    }

    saveState();

    resetTransactionForm();

    showPage("transactions");

  });

function editTransaction(id) {

  const t =
    state.transactions.find(x => x.id === id);

  if (!t) return;

  transactionType = t.type;

  document.getElementById("editTransactionId").value =
    t.id;

  document.getElementById("transactionAmount").value =
    t.amount;

  document.getElementById("transactionDate").value =
    t.date;

  document.getElementById("transactionNote").value =
    t.note || "";

  document.getElementById("transactionTags").value =
    t.tags || "";

  setTransactionType(t.type);

  document.getElementById("transactionCategoryInput").value =
    t.category;

  document.getElementById("transactionAccount").value =
    t.accountId;

  document.getElementById("paymentMethod").value =
    t.method || "Cash";

  showPage("add");
}

function deleteTransaction(id) {

  if (!confirm("Delete this transaction?"))
    return;

  state.transactions =
    state.transactions.filter(t => t.id !== id);

  saveState();

  toast("Transaction deleted.");
}


/* =========================================================
   ACCOUNTS
========================================================= */

function renderAccounts() {

  const grid =
    document.getElementById("accountsGrid");

  if (!grid) return;

  if (!state.accounts.length) {

    grid.innerHTML =
      `<div class="empty">No accounts.</div>`;

    return;
  }

  grid.innerHTML =
    state.accounts.map(a => {

      const balance = accountBalance(a.id);

      return `
        <div class="account-card">

          <div class="card-top">
            <div class="card-icon">▣</div>
            <span class="card-type">${escapeHTML(a.type)}</span>
          </div>

          <div class="card-title">
            ${escapeHTML(a.name)}
          </div>

          <div class="card-value">
            ${money(balance)}
          </div>

          <div class="card-meta">
            <span>Opening</span>
            <span>${money(a.opening)}</span>
          </div>

          ${
            state.accounts.length > 1
            ? `
              <div class="card-buttons">
                <button class="danger-btn"
                  onclick="deleteAccount('${a.id}')">
                  Delete
                </button>
              </div>
            `
            : ""
          }

        </div>
      `;

    }).join("");
}

function addAccount(e) {

  e.preventDefault();

  const name =
    document.getElementById("accountName").value.trim();

  const type =
    document.getElementById("accountType").value;

  const opening =
    Number(document.getElementById("accountBalance").value || 0);

  state.accounts.push({
    id: uid(),
    name,
    type,
    opening
  });

  saveState();

  e.target.reset();

  closeModal("accountModal");

  toast("Account created.");
}

function deleteAccount(id) {

  if (state.transactions.some(t => t.accountId === id)) {

    toast("This account has transactions. Delete those first.");
    return;
  }

  state.accounts =
    state.accounts.filter(a => a.id !== id);

  saveState();

  toast("Account deleted.");
}


/* =========================================================
   BUDGETS
========================================================= */

function budgetUsed(budget) {

  const m = monthKey();

  return state.transactions
    .filter(t =>
      t.type === "expense" &&
      t.category === budget.category &&
      t.date.startsWith(m)
    )
    .reduce((sum,t) =>
      sum + Number(t.amount),0);
}

function budgetHTML(b) {

  const used = budgetUsed(b);

  const percent =
    Math.min(100,Math.round(
      used / Number(b.limit) * 100
    ));

  return `
    <div class="budget-card">

      <div class="card-top">
        <div class="card-icon">
          ${icons[b.category] || "◉"}
        </div>

        <button class="small-btn"
          onclick="deleteBudget('${b.id}')">
          ×
        </button>
      </div>

      <div class="card-title">
        ${escapeHTML(b.category)}
      </div>

      <div class="card-value">
        ${money(used)}
      </div>

      <div class="card-meta">
        <span>Spent</span>
        <span>Limit ${money(b.limit)}</span>
      </div>

      <div class="progress ${percent >= 90 ? "red" : ""}">
        <div style="width:${percent}%"></div>
      </div>

      <div class="card-meta">
        <span>${percent}% used</span>
        <span>${money(Math.max(0,b.limit-used))} left</span>
      </div>

    </div>
  `;
}

function renderBudgets() {

  const grid =
    document.getElementById("budgetGrid");

  if (!grid) return;

  if (!state.budgets.length) {

    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◉</div>
        Create your first budget.
      </div>
    `;

    return;
  }

  grid.innerHTML =
    state.budgets.map(budgetHTML).join("");
}

function addBudget(e) {

  e.preventDefault();

  state.budgets.push({
    id: uid(),
    category:
      document.getElementById("budgetCategory").value,
    limit:
      Number(document.getElementById("budgetAmount").value)
  });

  saveState();

  closeModal("budgetModal");

  e.target.reset();

  toast("Budget created.");
}

function deleteBudget(id) {

  state.budgets =
    state.budgets.filter(b => b.id !== id);

  saveState();

  toast("Budget removed.");
}


/* =========================================================
   GOALS
========================================================= */

function renderGoals() {

  const grid =
    document.getElementById("goalsGrid");

  if (!grid) return;

  if (!state.goals.length) {

    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">★</div>
        Create your first savings goal.
      </div>
    `;

    return;
  }

  grid.innerHTML =
    state.goals.map(g => {

      const percent =
        Math.min(
          100,
          Math.round(g.saved / g.target * 100)
        );

      return `
        <div class="goal-card">

          <div class="card-top">
            <div class="card-icon">★</div>

            <button class="small-btn"
              onclick="deleteGoal('${g.id}')">
              ×
            </button>
          </div>

          <div class="card-title">
            ${escapeHTML(g.name)}
          </div>

          <div class="card-value">
            ${money(g.saved)}
          </div>

          <div class="card-meta">
            <span>Saved</span>
            <span>Target ${money(g.target)}</span>
          </div>

          <div class="progress green">
            <div style="width:${percent}%"></div>
          </div>

          <div class="card-meta">
            <span>${percent}% complete</span>
            <span>${money(Math.max(0,g.target-g.saved))} left</span>
          </div>

          <div class="card-buttons">

            <button class="primary-btn"
              onclick="addGoalMoney('${g.id}')">
              + Add Money
            </button>

          </div>

        </div>
      `;

    }).join("");
}

function addGoal(e) {

  e.preventDefault();

  state.goals.push({
    id: uid(),
    name:
      document.getElementById("goalName").value.trim(),
    target:
      Number(document.getElementById("goalTarget").value),
    saved:
      Number(document.getElementById("goalSaved").value || 0),
    date:
      document.getElementById("goalDate").value
  });

  saveState();

  closeModal("goalModal");

  e.target.reset();

  toast("Savings goal created.");
}

function addGoalMoney(id) {

  const goal =
    state.goals.find(g => g.id === id);

  if (!goal) return;

  const amount =
    Number(prompt("How much are you adding?"));

  if (!amount || amount <= 0) return;

  goal.saved += amount;

  saveState();

  toast("Savings goal updated.");
}

function deleteGoal(id) {

  state.goals =
    state.goals.filter(g => g.id !== id);

  saveState();

  toast("Goal removed.");
}


/* =========================================================
   RECURRING
========================================================= */

function renderRecurring() {

  const grid =
    document.getElementById("recurringGrid");

  if (!grid) return;

  if (!state.recurring.length) {

    grid.innerHTML = `
      <div class="empty">
        No recurring payments.
      </div>
    `;

    return;
  }

  grid.innerHTML =
    state.recurring.map(r => `

      <div class="recurring-card">

        <div class="card-top">

          <div class="card-icon">↻</div>

          <button class="small-btn"
            onclick="deleteRecurring('${r.id}')">
            ×
          </button>

        </div>

        <div class="card-title">
          ${escapeHTML(r.name)}
        </div>

        <div class="card-value">
          ${money(r.amount)}
        </div>

        <div class="card-meta">
          <span>${r.frequency}</span>
          <span>${formatDate(r.date)}</span>
        </div>

      </div>

    `).join("");
}

function addRecurring(e) {

  e.preventDefault();

  state.recurring.push({

    id: uid(),

    name:
      document.getElementById("recurringName").value,

    amount:
      Number(document.getElementById("recurringAmount").value),

    frequency:
      document.getElementById("recurringFrequency").value,

    date:
      document.getElementById("recurringDate").value

  });

  saveState();

  closeModal("recurringModal");

  e.target.reset();

  toast("Recurring payment added.");
}

function deleteRecurring(id) {

  state.recurring =
    state.recurring.filter(x => x.id !== id);

  saveState();

  toast("Recurring payment removed.");
}


/* =========================================================
   BILLS
========================================================= */

function renderBills() {

  const grid =
    document.getElementById("billsGrid");

  if (!grid) return;

  if (!state.bills.length) {

    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">▤</div>
        No bills added.
      </div>
    `;

    return;
  }

  const sorted =
    [...state.bills].sort(
      (a,b) => a.date.localeCompare(b.date)
    );

  grid.innerHTML =
    sorted.map(b => {

      const days = daysUntil(b.date);

      return `

        <div class="bill-card">

          <div class="card-top">

            <div class="card-icon">🧾</div>

            <button class="small-btn"
              onclick="deleteBill('${b.id}')">
              ×
            </button>

          </div>

          <div class="card-title">
            ${escapeHTML(b.name)}
          </div>

          <div class="card-value">
            ${money(b.amount)}
          </div>

          <div class="card-meta">
            <span>Due ${formatDate(b.date)}</span>
            <span>
              ${
                days < 0
                  ? "Overdue"
                  : days === 0
                    ? "Today"
                    : days + " days"
              }
            </span>
          </div>

        </div>

      `;

    }).join("");
}

function addBill(e) {

  e.preventDefault();

  state.bills.push({

    id: uid(),

    name:
      document.getElementById("billName").value,

    amount:
      Number(document.getElementById("billAmount").value),

    date:
      document.getElementById("billDate").value,

    category:
      document.getElementById("billCategory").value

  });

  saveState();

  closeModal("billModal");

  e.target.reset();

  toast("Bill added.");
}

function deleteBill(id) {

  state.bills =
    state.bills.filter(x => x.id !== id);

  saveState();

  toast("Bill deleted.");
}


/* =========================================================
   ANALYTICS
========================================================= */

function updateDashboardCharts() {

  if (!window.Chart) return;

  const cashCanvas =
    document.getElementById("cashflowChart");

  const categoryCanvas =
    document.getElementById("categoryChart");

  if (!cashCanvas || !categoryCanvas) return;

  const months = [];

  for (let i=5;i>=0;i--) {

    const d = new Date();

    d.setMonth(d.getMonth()-i);

    months.push(
      d.toISOString().slice(0,7)
    );

  }

  const incomeData =
    months.map(m =>
      state.transactions
        .filter(t =>
          t.type === "income" &&
          t.date.startsWith(m)
        )
        .reduce((s,t)=>s+Number(t.amount),0)
    );

  const expenseData =
    months.map(m =>
      state.transactions
        .filter(t =>
          t.type === "expense" &&
          t.date.startsWith(m)
        )
        .reduce((s,t)=>s+Number(t.amount),0)
    );

  if (cashflowChart)
    cashflowChart.destroy();

  cashflowChart =
    new Chart(cashCanvas, {

      type: "line",

      data: {
        labels: months.map(x => x.slice(5)),
        datasets: [
          {
            label: "Income",
            data: incomeData,
            borderWidth: 2,
            tension: .35
          },
          {
            label: "Expenses",
            data: expenseData,
            borderWidth: 2,
            tension: .35
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            labels: {
              color: getComputedStyle(document.body)
                .getPropertyValue("--muted")
            }
          }
        },

        scales: {
          x: {
            grid: {display:false}
          },

          y: {
            beginAtZero:true
          }
        }
      }

    });


  const categoryTotals = {};

  state.transactions
    .filter(t => t.type === "expense")
    .forEach(t => {

      categoryTotals[t.category] =
        (categoryTotals[t.category] || 0)
        + Number(t.amount);

    });

  const labels =
    Object.keys(categoryTotals);

  const values =
    Object.values(categoryTotals);

  if (categoryChart)
    categoryChart.destroy();

  categoryChart =
    new Chart(categoryCanvas, {

      type: "doughnut",

      data: {
        labels,
        datasets: [{
          data: values,
          borderWidth: 0
        }]
      },

      options: {
        responsive:true,
        maintainAspectRatio:false,

        plugins: {
          legend: {
            position:"bottom"
          }
        }
      }

    });
}

function renderAnalytics() {

  const expenses =
    state.transactions
      .filter(t=>t.type==="expense");

  const avg =
    expenses.length
      ? expenses.reduce((s,t)=>s+Number(t.amount),0)
        / Math.max(1,new Set(expenses.map(t=>t.date)).size)
      : 0;

  const largest =
    expenses.length
      ? Math.max(...expenses.map(t=>Number(t.amount)))
      : 0;

  const income = monthlyIncome();
  const expense = monthlyExpense();

  document.getElementById("avgSpend").textContent =
    money(avg);

  document.getElementById("largestExpense").textContent =
    money(largest);

  document.getElementById("transactionCount").textContent =
    state.transactions.length;

  document.getElementById("analyticsSavingRate").textContent =
    (income ? Math.round((income-expense)/income*100) : 0) + "%";

  setTimeout(() => {

    updateAnalyticsCharts();

  },50);
}

function updateAnalyticsCharts() {

  if (!window.Chart) return;

  const c1 =
    document.getElementById("analyticsCashChart");

  const c2 =
    document.getElementById("analyticsCategoryChart");

  if (!c1 || !c2) return;

  if (analyticsCashChart)
    analyticsCashChart.destroy();

  if (analyticsCategoryChart)
    analyticsCategoryChart.destroy();

  const months=[];

  for(let i=11;i>=0;i--) {

    const d=new Date();

    d.setMonth(d.getMonth()-i);

    months.push(
      d.toISOString().slice(0,7)
    );

  }

  const inc=months.map(m=>
    state.transactions
      .filter(t=>t.type==="income"&&t.date.startsWith(m))
      .reduce((s,t)=>s+Number(t.amount),0)
  );

  const exp=months.map(m=>
    state.transactions
      .filter(t=>t.type==="expense"&&t.date.startsWith(m))
      .reduce((s,t)=>s+Number(t.amount),0)
  );

  analyticsCashChart=new Chart(c1,{

    type:"bar",

    data:{
      labels:months.map(m=>m.slice(5)),
      datasets:[
        {
          label:"Income",
          data:inc
        },
        {
          label:"Expenses",
          data:exp
        }
      ]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false
    }

  });

  const totals={};

  state.transactions
    .filter(t=>t.type==="expense")
    .forEach(t=>{
      totals[t.category]=(totals[t.category]||0)+Number(t.amount);
    });

  analyticsCategoryChart=new Chart(c2,{

    type:"polarArea",

    data:{
      labels:Object.keys(totals),
      datasets:[
        {
          data:Object.values(totals)
        }
      ]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false
    }

  });
}


/* =========================================================
   REPORTS
========================================================= */

function renderReport() {

  const box =
    document.getElementById("reportContent");

  if (!box) return;

  const input =
    document.getElementById("reportMonth");

  if (!input.value)
    input.value = monthKey();

  const m = input.value;

  const tx =
    state.transactions.filter(
      t=>t.date.startsWith(m)
    );

  const income =
    tx.filter(t=>t.type==="income")
      .reduce((s,t)=>s+Number(t.amount),0);

  const expense =
    tx.filter(t=>t.type==="expense")
      .reduce((s,t)=>s+Number(t.amount),0);

  box.innerHTML=`

    <div class="report-summary">

      <div class="report-number">
        <small>Income</small>
        <strong style="color:var(--green)">
          ${money(income)}
        </strong>
      </div>

      <div class="report-number">
        <small>Expenses</small>
        <strong style="color:var(--red)">
          ${money(expense)}
        </strong>
      </div>

      <div class="report-number">
        <small>Net Savings</small>
        <strong>
          ${money(income-expense)}
        </strong>
      </div>

    </div>

    <div class="panel">

      <div class="panel-head">
        <h3>Transactions in ${m}</h3>
        <span>${tx.length} entries</span>
      </div>

      ${
        tx.length
        ? tx.map(t=>transactionHTML(t)).join("")
        : `<div class="empty">No activity for this month.</div>`
      }

    </div>
  `;
}


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendarDay() {

  const input =
    document.getElementById("calendarDate");

  const box =
    document.getElementById("calendarDay");

  if (!input || !box) return;

  if (!input.value)
    input.value=localDate();

  const date=input.value;

  const tx=
    state.transactions.filter(
      t=>t.date===date
    );

  box.innerHTML=`

    <div class="panel-head">
      <div>
        <h3>${formatDate(date)}</h3>
        <p>${tx.length} transaction(s)</p>
      </div>
    </div>

    ${
      tx.length
      ? tx.map(t=>transactionHTML(t)).join("")
      : `<div class="empty">Nothing recorded on this day.</div>`
    }

  `;
}


/* =========================================================
   INSIGHTS
========================================================= */

function renderInsights() {

  const grid =
    document.getElementById("insightsGrid");

  if (!grid) return;

  const income=monthlyIncome();
  const expense=monthlyExpense();

  const cards=[];

  if (!state.transactions.length) {

    cards.push({
      icon:"🚀",
      title:"Start tracking",
      text:"Add your first transaction to unlock personalized spending observations."
    });

  } else {

    const rate =
      income
      ? Math.round((income-expense)/income*100)
      : 0;

    cards.push({
      icon:"💰",
      title:"Monthly cash flow",
      text:
        `You have ${money(income-expense)} net cash flow this month.`
    });

    cards.push({
      icon:"📊",
      title:"Saving rate",
      text:
        income
        ? `Your current saving rate is approximately ${rate}%.`
        : "Add income transactions to calculate your saving rate."
    });

    const totals={};

    state.transactions
      .filter(t=>t.type==="expense")
      .forEach(t=>{
        totals[t.category]=(totals[t.category]||0)+Number(t.amount);
      });

    const top =
      Object.entries(totals)
        .sort((a,b)=>b[1]-a[1])[0];

    if(top){

      cards.push({
        icon:icons[top[0]]||"●",
        title:"Largest spending category",
        text:
          `${top[0]} is currently your largest recorded expense category at ${money(top[1])}.`
      });

    }

    const biggest =
      state.transactions
        .filter(t=>t.type==="expense")
        .sort((a,b)=>b.amount-a.amount)[0];

    if(biggest){

      cards.push({
        icon:"⚡",
        title:"Largest single expense",
        text:
          `${biggest.note || biggest.category} was recorded at ${money(biggest.amount)}.`
      });

    }

    const upcoming =
      state.bills
        .filter(b=>daysUntil(b.date)>=0)
        .sort((a,b)=>a.date.localeCompare(b.date))[0];

    if(upcoming){

      cards.push({
        icon:"🧾",
        title:"Upcoming bill",
        text:
          `${upcoming.name} is due on ${formatDate(upcoming.date)} for ${money(upcoming.amount)}.`
      });

    }

  }

  grid.innerHTML =
    cards.map(c=>`

      <div class="insight-card">

        <div class="insight-icon">
          ${c.icon}
        </div>

        <h3>${escapeHTML(c.title)}</h3>

        <p>${escapeHTML(c.text)}</p>

      </div>

    `).join("");
}


/* =========================================================
   OCR RECEIPT
========================================================= */

async function scanReceipt(event) {

  const file =
    event.target.files[0];

  if (!file) return;

  const progress =
    document.getElementById("scanProgress");

  const bar =
    document.getElementById("ocrProgress");

  const status =
    document.getElementById("ocrStatus");

  progress.classList.remove("hidden");

  try {

    const result =
      await Tesseract.recognize(
        file,
        "eng",
        {
          logger: data => {

            if(data.status === "recognizing text"){

              const pct =
                Math.round((data.progress || 0)*100);

              bar.style.width=pct+"%";

              status.textContent =
                "Reading receipt... "+pct+"%";
            }

          }
        }
      );

    const text =
      result.data.text;

    document.getElementById("ocrText").value =
      text;

    const amount =
      detectAmount(text);

    document.getElementById("detectedAmount").textContent =
      money(amount);

    status.textContent =
      "Scan complete.";

    toast("Receipt scanned.");

  } catch(error) {

    console.error(error);

    status.textContent =
      "OCR failed. Try a clearer image.";

    toast("Could not read receipt.");

  }
}

function detectAmount(text) {

  const matches =
    text.match(
      /(?:₹|rs\.?|inr)?\s?(\d+(?:[,.]\d{1,2})?)/gi
    );

  if(!matches || !matches.length)
    return 0;

  const nums =
    matches
      .map(x =>
        parseFloat(
          x.replace(/[^\d.]/g,"")
        )
      )
      .filter(x=>x>0);

  return nums.length
    ? Math.max(...nums)
    : 0;
}

function createFromOCR() {

  const amount =
    parseFloat(
      document.getElementById("detectedAmount")
        .textContent
        .replace(/[^\d.]/g,"")
    );

  if(!amount){

    toast("No amount detected.");
    return;

  }

  document.getElementById("transactionAmount").value =
    amount;

  document.getElementById("transactionCategoryInput").value =
    "Other";

  document.getElementById("transactionNote").value =
    "Receipt purchase";

  setTransactionType("expense");

  showPage("add");

  toast("Receipt data moved to transaction form.");
}


/* =========================================================
   PREMIUM / ANDROID BILLING BRIDGE
========================================================= */

function buyPremium(plan) {

  const productIds = {

    monthly:
      "finance_manager_premium_monthly",

    twoMonths:
      "finance_manager_premium_2months"

  };

  const productId =
    productIds[plan];

  /*
    Android native bridge.

    Your Android app can expose:

    window.AndroidBilling.purchase(productId)

    After Google Play verifies the purchase,
    Android should call:

    window.onPlayPurchaseVerified(
      productId,
      expiryTimestamp
    )
  */

  if (
    window.AndroidBilling &&
    typeof window.AndroidBilling.purchase === "function"
  ) {

    window.AndroidBilling.purchase(productId);

    return;
  }

  /*
    iOS/web bridge placeholder.
  */

  if (
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.playBilling
  ) {

    window.webkit.messageHandlers.playBilling.postMessage({
      productId
    });

    return;
  }

  toast(
    "Connect Google Play Billing in the Android app to process this purchase."
  );
}

window.onPlayPurchaseVerified =
  function(productId, expiryTimestamp) {

    let plan =
      productId.includes("2months")
        ? "twoMonths"
        : "monthly";

    state.premium = {

      active: true,

      plan,

      expiresAt:
        Number(expiryTimestamp)

    };

    saveState();

    toast("Premium activated.");

  };

function premiumActive() {

  if(!state.premium.active)
    return false;

  if(
    state.premium.expiresAt &&
    Date.now() > state.premium.expiresAt
  ){

    state.premium.active=false;

    saveState();

    return false;

  }

  return true;
}


/* =========================================================
   BACKUP
========================================================= */

function backupData() {

  const blob =
    new Blob(
      [JSON.stringify(state,null,2)],
      {type:"application/json"}
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href=url;

  a.download =
    "finance-manager-backup-" +
    localDate() +
    ".json";

  a.click();

  URL.revokeObjectURL(url);

  toast("Backup downloaded.");
}

function restoreData(event) {

  const file =
    event.target.files[0];

  if(!file) return;

  const reader =
    new FileReader();

  reader.onload=function(){

    try {

      const imported =
        JSON.parse(reader.result);

      if(
        !imported.transactions ||
        !imported.accounts
      ){

        throw new Error("Invalid");

      }

      state=imported;

      saveState();

      toast("Backup restored.");

    } catch(e) {

      toast("Invalid backup file.");

    }

  };

  reader.readAsText(file);
}

function exportCSV() {

  const header =
    [
      "Date",
      "Type",
      "Category",
      "Amount",
      "Account",
      "Payment Method",
      "Note",
      "Tags"
    ];

  const rows =
    state.transactions.map(t=>{

      const account =
        state.accounts.find(
          a=>a.id===t.accountId
        );

      return [
        t.date,
        t.type,
        t.category,
        t.amount,
        account?.name || "",
        t.method || "",
        t.note || "",
        t.tags || ""
      ].map(csvEscape).join(",");

    });

  const csv =
    [header.join(","),...rows].join("\n");

  const blob =
    new Blob([csv],{
      type:"text/csv;charset=utf-8"
    });

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href=url;
  a.download="finance-manager-transactions.csv";

  a.click();

  URL.revokeObjectURL(url);

  toast("CSV exported.");
}


/* =========================================================
   SETTINGS
========================================================= */

function changeTheme(theme) {

  state.settings.theme=theme;

  saveState();

  toast("Theme changed.");
}

function changeCurrency(currency) {

  state.settings.currency=currency;

  saveState();

  toast("Currency changed.");
}

function applyTheme() {

  document.body.classList.toggle(
    "light",
    state.settings.theme==="light"
  );

  const theme =
    document.getElementById("themeSetting");

  const currency =
    document.getElementById("currencySetting");

  if(theme)
    theme.value=state.settings.theme;

  if(currency)
    currency.value=state.settings.currency;
}

function resetApp() {

  if(!confirm(
    "This will permanently remove local Finance Manager data. Continue?"
  )) return;

  localStorage.removeItem(KEY);

  state=loadState();

  refreshEverything();

  toast("Application reset.");
}


/* =========================================================
   SELECTORS
========================================================= */

function populateSelectors() {

  populateTransactionCategories();

  const categorySelect =
    document.getElementById("transactionCategory");

  const budgetCategory =
    document.getElementById("budgetCategory");

  const billCategory =
    document.getElementById("billCategory");

  if(categorySelect){

    const current=categorySelect.value;

    categorySelect.innerHTML =
      `<option value="all">All categories</option>` +
      categories.map(c =>
        `<option>${c}</option>`
      ).join("");

    categorySelect.value=current;

  }

  if(budgetCategory){

    budgetCategory.innerHTML =
      categories
        .filter(c=>c!=="Salary")
        .map(c=>
          `<option>${c}</option>`
        ).join("");

  }

  if(billCategory){

    billCategory.innerHTML =
      categories
        .map(c=>
          `<option>${c}</option>`
        ).join("");

  }

  const accountSelect =
    document.getElementById("transactionAccount");

  if(accountSelect){

    const current=accountSelect.value;

    accountSelect.innerHTML =
      state.accounts.map(a=>
        `<option value="${a.id}">
          ${escapeHTML(a.name)}
        </option>`
      ).join("");

    if(current)
      accountSelect.value=current;

  }
}

function populateTransactionCategories() {

  const select =
    document.getElementById(
      "transactionCategoryInput"
    );

  if(!select) return;

  const current=select.value;

  select.innerHTML =
    categories.map(c=>
      `<option>${c}</option>`
    ).join("");

  if(categories.includes(current))
    select.value=current;
}


/* =========================================================
   MODALS
========================================================= */

function openModal(id) {

  document
    .getElementById(id)
    .classList.add("open");

}

function closeModal(id) {

  document
    .getElementById(id)
    .classList.remove("open");

}

document.querySelectorAll(".modal")
  .forEach(modal=>{

    modal.addEventListener("click",e=>{

      if(e.target===modal)
        modal.classList.remove("open");

    });

  });


/* =========================================================
   HELPERS
========================================================= */

function formatDate(date) {

  if(!date) return "";

  const d =
    new Date(date+"T00:00:00");

  return d.toLocaleDateString(
    "en-IN",
    {
      day:"numeric",
      month:"short",
      year:"numeric"
    }
  );
}

function daysUntil(date) {

  const now =
    new Date();

  const target =
    new Date(date+"T00:00:00");

  now.setHours(0,0,0,0);

  return Math.ceil(
    (target-now)/(1000*60*60*24)
  );
}

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function csvEscape(value) {

  return `"${String(value ?? "")
    .replace(/"/g,'""')}"`;
}


/* =========================================================
   INIT
========================================================= */

function init() {

  document.getElementById("transactionDate").value =
    localDate();

  document.getElementById("calendarDate").value =
    localDate();

  document.getElementById("reportMonth").value =
    monthKey();

  populateSelectors();

  setTransactionType("expense");

  refreshEverything();

  document.getElementById("randomTip").textContent =
    [
      "Track small purchases. They can add up quickly.",
      "Give every rupee a job before spending it.",
      "A budget is a plan, not a restriction.",
      "Review your spending regularly.",
      "Saving becomes easier when you make it measurable."
    ][Math.floor(Math.random()*5)];

}

init();
