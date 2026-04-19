import { supabase } from "../config/supabase.js";

const state = {
  items: [],
  stock: [],
  movements: [],
  filters: {
    search: ""
  }
};

function el(id) {
  return document.getElementById(id);
}

function clearItemForm() {
  if (el("inventory-item-name")) el("inventory-item-name").value = "";
  if (el("inventory-item-unit")) el("inventory-item-unit").value = "unidade";
  if (el("inventory-item-description")) el("inventory-item-description").value = "";
}

function clearMoveForm() {
  if (el("inventory-move-item")) el("inventory-move-item").value = "";
  if (el("inventory-move-type")) el("inventory-move-type").value = "in";
  if (el("inventory-move-qty")) el("inventory-move-qty").value = "";
  if (el("inventory-move-reason")) el("inventory-move-reason").value = "";
  if (el("inventory-move-reference")) el("inventory-move-reference").value = "";
}

async function loadItems() {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("name");

  if (error) {
    console.error("Erro ao carregar itens:", error);
    state.items = [];
    renderMoveItems();
    return;
  }

  state.items = data || [];
  renderMoveItems();
}

function renderMoveItems() {
  const select = el("inventory-move-item");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecionar item</option>
    ${state.items.map(item => `<option value="${item.id}">${item.name}</option>`).join("")}
  `;
}

async function loadMovements() {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar movimentos:", error);
    state.movements = [];
    return;
  }

  state.movements = data || [];
}

async function loadStock() {
  const { data, error } = await supabase.rpc("get_stock");

  if (error) {
    console.error("Erro ao carregar stock:", error);
    state.stock = [];
    renderStats();
    renderStock();
    return;
  }

  const rows = (data || []).map((row) => {
    const item = state.items.find((i) => i.name === row.name);
    return {
      ...row,
      unit: item?.unit || "unidade",
      description: item?.description || ""
    };
  });

  state.stock = rows;
  renderStats();
  renderStock();
}

function renderStats() {
  const search = (state.filters.search || "").trim().toLowerCase();
  const rows = state.stock.filter((item) => {
    if (!search) return true;
    return (item.name || "").toLowerCase().includes(search);
  });

  const totalItems = rows.length;
  const withStock = rows.filter((item) => Number(item.stock || 0) > 0).length;
  const noStock = rows.filter((item) => Number(item.stock || 0) <= 0).length;
  const movementsCount = state.movements.length;

  if (el("inventory-items-count")) el("inventory-items-count").textContent = totalItems;
  if (el("inventory-positive-count")) el("inventory-positive-count").textContent = withStock;
  if (el("inventory-zero-count")) el("inventory-zero-count").textContent = noStock;
  if (el("inventory-movements-count")) el("inventory-movements-count").textContent = movementsCount;
}

function renderStock() {
  const tbody = el("inventory-stock-body");
  if (!tbody) return;

  const search = (state.filters.search || "").trim().toLowerCase();

  const rows = state.stock.filter((item) => {
    if (!search) return true;
    return (
      (item.name || "").toLowerCase().includes(search) ||
      (item.description || "").toLowerCase().includes(search)
    );
  });

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Nenhum item encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr>
      <td>${item.name || "-"}</td>
      <td>${item.unit || "-"}</td>
      <td>${item.description || "-"}</td>
      <td>${Number(item.stock || 0)}</td>
    </tr>
  `).join("");
}

async function createItem(event) {
  event.preventDefault();

  const name = el("inventory-item-name")?.value?.trim() || "";
  const unit = el("inventory-item-unit")?.value?.trim() || "unidade";
  const description = el("inventory-item-description")?.value?.trim() || null;

  if (!name) {
    alert("Preencha o nome do item.");
    return;
  }

  const { error } = await supabase
    .from("inventory_items")
    .insert([{ name, unit, description }]);

  if (error) {
    console.error("Erro ao guardar item:", error);
    alert(error.message || "Erro ao guardar item.");
    return;
  }

  clearItemForm();
  await loadItems();
  await loadStock();
}

async function createMovement(event) {
  event.preventDefault();

  const itemId = el("inventory-move-item")?.value || "";
  const type = el("inventory-move-type")?.value || "in";
  const quantity = Number(el("inventory-move-qty")?.value || 0);
  const reason = el("inventory-move-reason")?.value?.trim() || null;
  const reference = el("inventory-move-reference")?.value?.trim() || null;

  if (!itemId) {
    alert("Seleciona o item.");
    return;
  }

  if (!quantity || quantity <= 0) {
    alert("Preencha uma quantidade válida.");
    return;
  }

  if (type === "out") {
    const item = state.items.find((i) => i.id === itemId);
    const stockRow = state.stock.find((s) => s.name === item?.name);
    const currentStock = Number(stockRow?.stock || 0);

    if (quantity > currentStock) {
      alert("Stock insuficiente para esta saída.");
      return;
    }
  }

  const { error } = await supabase
    .from("inventory_movements")
    .insert([{
      item_id: itemId,
      type,
      quantity,
      reason,
      reference
    }]);

  if (error) {
    console.error("Erro ao guardar movimento:", error);
    alert(error.message || "Erro ao guardar movimento.");
    return;
  }

  clearMoveForm();
  await loadMovements();
  await loadStock();
}

function bindEvents() {
  el("inventory-item-form")?.addEventListener("submit", createItem);
  el("inventory-move-form")?.addEventListener("submit", createMovement);

  el("inventory-item-reset-btn")?.addEventListener("click", clearItemForm);
  el("inventory-move-reset-btn")?.addEventListener("click", clearMoveForm);

  el("inventory-search")?.addEventListener("input", (event) => {
    state.filters.search = event.target.value || "";
    renderStats();
    renderStock();
  });
}

export async function initInventarioPage() {
  bindEvents();
  clearItemForm();
  clearMoveForm();
  await loadItems();
  await loadMovements();
  await loadStock();
}
