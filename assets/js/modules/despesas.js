import { supabase } from "../config/supabase.js";

const state = {
  expenses: [],
  filtered: [],
  editingId: null,
  filters: {
    search: "",
    category: ""
  }
};

function el(id) {
  return document.getElementById(id);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function clearForm() {
  state.editingId = null;

  if (el("expense-id")) el("expense-id").value = "";
  if (el("expense-item")) el("expense-item").value = "";
  if (el("expense-category")) el("expense-category").value = "";
  if (el("expense-qty")) el("expense-qty").value = "1";
  if (el("expense-price")) el("expense-price").value = "0";
  if (el("expense-total")) el("expense-total").value = "";
  if (el("expense-date")) el("expense-date").value = new Date().toISOString().split("T")[0];
  if (el("expense-notes")) el("expense-notes").value = "";

  const title = el("expense-form-title");
  if (title) title.textContent = "Nova despesa";
}

function fillForm(item) {
  state.editingId = item.id || null;

  if (el("expense-id")) el("expense-id").value = item.id || "";
  if (el("expense-item")) el("expense-item").value = item.item || "";
  if (el("expense-category")) el("expense-category").value = item.category || "";
  if (el("expense-qty")) el("expense-qty").value = item.quantity ?? 1;
  if (el("expense-price")) el("expense-price").value = item.unit_price ?? 0;
  if (el("expense-total")) el("expense-total").value = item.total_amount ?? 0;
  if (el("expense-date")) el("expense-date").value = item.expense_date || "";
  if (el("expense-notes")) el("expense-notes").value = item.notes || "";

  const title = el("expense-form-title");
  if (title) title.textContent = "Editar despesa";
}

function recalcTotal() {
  const qty = Number(el("expense-qty")?.value || 0);
  const price = Number(el("expense-price")?.value || 0);
  const total = qty * price;

  if (el("expense-total")) {
    el("expense-total").value = total ? total.toFixed(2) : "";
  }
}

function applyFilters() {
  let rows = [...state.expenses];

  if (state.filters.search.trim()) {
    const term = state.filters.search.trim().toLowerCase();

    rows = rows.filter((item) => {
      return (
        (item.item || "").toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term) ||
        (item.notes || "").toLowerCase().includes(term)
      );
    });
  }

  if (state.filters.category) {
    rows = rows.filter((item) => item.category === state.filters.category);
  }

  state.filtered = rows;
}

function renderStats() {
  const rows = state.filtered;

  const total = rows.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonthTotal = rows
    .filter((item) => {
      if (!item.expense_date) return false;
      const d = new Date(item.expense_date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  const categoriesUsed = new Set(
    rows.map((item) => item.category).filter(Boolean)
  ).size;

  if (el("expenses-count")) el("expenses-count").textContent = rows.length;
  if (el("expenses-total")) el("expenses-total").textContent = formatMoney(total);
  if (el("expenses-this-month")) el("expenses-this-month").textContent = formatMoney(thisMonthTotal);
  if (el("expenses-categories")) el("expenses-categories").textContent = categoriesUsed;
}

function renderTable() {
  const tbody = el("expensesTableBody");
  if (!tbody) return;

  if (!state.filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Nenhuma despesa encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filtered.map((item) => `
    <tr>
      <td>${item.item || "-"}</td>
      <td>${item.category || "-"}</td>
      <td>${item.quantity ?? 0}</td>
      <td>${formatMoney(item.unit_price)}</td>
      <td>${formatMoney(item.total_amount)}</td>
      <td>${item.expense_date || "-"}</td>
      <td>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="edit"
          data-id="${item.id}"
        >
          Editar
        </button>
        <button
          type="button"
          class="btn btn-danger btn-sm"
          data-action="delete"
          data-id="${item.id}"
        >
          Eliminar
        </button>
      </td>
    </tr>
  `).join("");
}

async function fetchExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar despesas:", error);
    state.expenses = [];
    applyFilters();
    renderStats();
    renderTable();
    return;
  }

  state.expenses = data || [];
  applyFilters();
  renderStats();
  renderTable();
}

async function ensureInventoryItem(itemName) {
  const { data: existing, error: existingError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("name", itemName)
    .maybeSingle();

  if (existingError) {
    console.error("Erro ao procurar item no inventário:", existingError);
    return null;
  }

  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("inventory_items")
    .insert([{ name: itemName, unit: "unidade" }])
    .select("id")
    .single();

  if (createError) {
    console.error("Erro ao criar item no inventário:", createError);
    return null;
  }

  return created?.id || null;
}

async function createInventoryEntryFromExpense(expenseId, itemName, quantity) {
  const itemId = await ensureInventoryItem(itemName);
  if (!itemId) return;

  const qty = Number(quantity || 0);
  if (qty <= 0) return;

  const { error } = await supabase
    .from("inventory_movements")
    .insert([{
      item_id: itemId,
      type: "in",
      quantity: qty,
      reason: "Entrada automática por despesa",
      reference: `expense:${expenseId}`
    }]);

  if (error) {
    console.error("Erro ao criar movimento automático de inventário:", error);
  }
}

async function saveExpense(event) {
  event.preventDefault();

  const item = el("expense-item")?.value?.trim() || "";
  const category = el("expense-category")?.value || null;
  const quantity = Number(el("expense-qty")?.value || 0);
  const unitPrice = Number(el("expense-price")?.value || 0);
  const totalAmount = Number(el("expense-total")?.value || 0);
  const expenseDate = el("expense-date")?.value || null;
  const notes = el("expense-notes")?.value?.trim() || null;

  if (!item) {
    alert("Preencha o item.");
    return;
  }

  if (!totalAmount || totalAmount <= 0) {
    alert("Preencha o valor total pago.");
    return;
  }

  const payload = {
    item,
    category,
    quantity,
    unit_price: unitPrice,
    total_amount: totalAmount,
    expense_date: expenseDate,
    notes
  };

  let error = null;
  let savedRow = null;

  if (state.editingId) {
    ({ error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", state.editingId));
  } else {
    const response = await supabase
      .from("expenses")
      .insert([payload])
      .select("*")
      .single();

    error = response.error;
    savedRow = response.data;
  }

  if (error) {
    console.error("Erro ao guardar despesa:", error);
    alert(error.message || "Erro ao guardar despesa.");
    return;
  }

  if (!state.editingId && category === "material") {
    await createInventoryEntryFromExpense(savedRow?.id, item, quantity || 1);
  }

  clearForm();
  await fetchExpenses();
}

async function deleteExpense(id) {
  const confirmed = window.confirm("Deseja eliminar esta despesa?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao eliminar despesa:", error);
    alert(error.message || "Não foi possível eliminar a despesa.");
    return;
  }

  await fetchExpenses();
}

function bindEvents() {
  el("expense-form")?.addEventListener("submit", saveExpense);

  el("expense-reset-btn")?.addEventListener("click", () => {
    clearForm();
  });

  el("expense-qty")?.addEventListener("input", recalcTotal);
  el("expense-price")?.addEventListener("input", recalcTotal);

  el("expense-search")?.addEventListener("input", (event) => {
    state.filters.search = event.target.value || "";
    applyFilters();
    renderStats();
    renderTable();
  });

  el("expense-category-filter")?.addEventListener("change", (event) => {
    state.filters.category = event.target.value || "";
    applyFilters();
    renderStats();
    renderTable();
  });

  el("expensesTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const item = state.expenses.find((row) => row.id === id);

    if (action === "edit" && item) {
      fillForm(item);
      return;
    }

    if (action === "delete" && id) {
      await deleteExpense(id);
    }
  });
}

export async function initExpensesPage() {
  bindEvents();
  clearForm();
  await fetchExpenses();
}
