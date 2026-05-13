import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { authEnabled, supabaseAuth } from "./auth.js";

const PROBLEM_STATUSES = ["Refusé", "Annulé", "Injoignable", "Retourné", "Reporté", "En retard", "Adresse incorrecte", "Téléphone incorrect"];
const COMMISSION_AMOUNT = 15;

const i18n = {
  fr: {
    app: "COD Recovery Center",
    subtitle: "Recuperer les commandes Sendit problematiques et convertir les pertes en livraisons.",
    dashboard: "Dashboard",
    recovery: "Recovery Center",
    commissions: "Commission Center",
    templates: "Message Templates",
    settings: "Settings",
    actionOrders: "Commandes a traiter",
    recovered: "Commandes recuperees",
    totalCommission: "Commission totale",
    recoveryRate: "Recovery rate",
    followedToday: "Suivies aujourd'hui",
    search: "Rechercher phone, order ID, client...",
    status: "Statut",
    city: "Ville",
    product: "Produit",
    employee: "Employe",
    all: "Tous",
    orderDetail: "Detail commande",
    customer: "Client",
    timeline: "Timeline statut",
    notes: "Notes de suivi",
    suggested: "Message suggere",
    copy: "Copier",
    whatsapp: "WhatsApp",
    addNote: "Ajouter note",
    assign: "Assigner",
    markFollowed: "Marquer suivi",
    markRecovered: "Marquer recupere",
    pending: "Pending",
    approved: "Approved",
    approve: "Approuver",
    addTemplate: "Ajouter template",
    addEmployee: "Ajouter employe",
    dark: "Dark",
    light: "Light",
    apiIssue: "API non disponible ou Supabase pas encore configure.",
    authDisabled: "Auth inactive: ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
    signIn: "Envoyer lien de connexion",
    email: "Email",
  },
  ar: {
    app: "COD Recovery Center",
    subtitle: "إنقاذ طلبات Sendit المشكلة وتحويلها إلى طلبات مسلمة.",
    dashboard: "لوحة التحكم",
    recovery: "مركز الريكوفري",
    commissions: "مركز العمولات",
    templates: "رسائل المتابعة",
    settings: "الإعدادات",
    actionOrders: "طلبات تحتاج إجراء",
    recovered: "طلبات تم إنقاذها",
    totalCommission: "مجموع العمولة",
    recoveryRate: "نسبة الإنقاذ",
    followedToday: "تمت متابعتها اليوم",
    search: "بحث بالهاتف، الطلب، الزبون...",
    status: "الحالة",
    city: "المدينة",
    product: "المنتج",
    employee: "الموظف",
    all: "الكل",
    orderDetail: "تفاصيل الطلب",
    customer: "الزبون",
    timeline: "مسار الحالة",
    notes: "ملاحظات المتابعة",
    suggested: "رسالة مقترحة",
    copy: "نسخ",
    whatsapp: "واتساب",
    addNote: "إضافة ملاحظة",
    assign: "تعيين",
    markFollowed: "تحديد كمتابع",
    markRecovered: "تحديد كمنقذ",
    pending: "معلقة",
    approved: "مصادق عليها",
    approve: "مصادقة",
    addTemplate: "إضافة رسالة",
    addEmployee: "إضافة موظف",
    dark: "داكن",
    light: "فاتح",
    apiIssue: "الـ API غير متاح أو Supabase غير مهيأ بعد.",
    authDisabled: "Auth غير مفعل: أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.",
    signIn: "إرسال رابط الدخول",
    email: "الإيميل",
  },
};

function money(value) {
  return `${Number(value || 0).toLocaleString("fr-MA")} MAD`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function renderTemplate(message, order) {
  if (!order) return message;
  return message
    .replaceAll("{name}", order.customer_name || "")
    .replaceAll("{orderId}", order.sendit_order_id || order.order_reference || "")
    .replaceAll("{city}", order.city || "");
}

export default function App() {
  const [language, setLanguage] = useState("fr");
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [problematicOrders, setProblematicOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [commissionSummary, setCommissionSummary] = useState({ total: 0, byEmployee: [] });
  const [templates, setTemplates] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", city: "", product: "", employee_id: "" });
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [employeeDraft, setEmployeeDraft] = useState({ name: "", email: "", role: "recovery" });
  const [templateDraft, setTemplateDraft] = useState({ status: "Refusé", language: "darija", title: "", message: "" });

  const t = i18n[language];

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [allOrders, problemOrders, staff, allCommissions, summary, allTemplates] = await Promise.all([
        api.orders(),
        api.problematicOrders(),
        api.employees(),
        api.commissions(),
        api.commissionSummary(),
        api.templates(),
      ]);
      setOrders(allOrders);
      setProblematicOrders(problemOrders);
      setEmployees(staff);
      setCommissions(allCommissions);
      setCommissionSummary(summary);
      setTemplates(allTemplates);
      setSelectedOrder(problemOrders[0] || allOrders[0] || null);
    } catch (err) {
      setError(err.message || t.apiIssue);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedOrder?.id) return;
    api.order(selectedOrder.id).then(setSelectedDetail).catch(() => setSelectedDetail(null));
  }, [selectedOrder?.id]);

  const filteredOrders = useMemo(() => {
    return problematicOrders.filter((order) => {
      const search = filters.search.trim().toLowerCase();
      const matchesSearch =
        !search ||
        [order.sendit_order_id, order.order_reference, order.customer_name, order.phone]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesStatus = !filters.status || order.current_status === filters.status;
      const matchesCity = !filters.city || order.city?.toLowerCase().includes(filters.city.toLowerCase());
      const matchesProduct = !filters.product || order.product_name?.toLowerCase().includes(filters.product.toLowerCase());
      const matchesEmployee = !filters.employee_id || order.assigned_employee_id === filters.employee_id;
      return matchesSearch && matchesStatus && matchesCity && matchesProduct && matchesEmployee;
    });
  }, [filters, problematicOrders]);

  const metrics = useMemo(() => {
    const recovered = orders.filter((order) => order.is_recovered).length;
    const followedToday = (selectedDetail?.followups || []).filter((item) => item.created_at?.startsWith(todayIsoDate())).length;
    const actionBase = orders.filter((order) => order.followup_attempts > 0 || order.is_recovered).length;
    return {
      actionOrders: problematicOrders.length,
      recovered,
      totalCommission: commissionSummary.total || commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      recoveryRate: actionBase ? Math.round((recovered / actionBase) * 100) : 0,
      followedToday,
    };
  }, [orders, problematicOrders.length, commissionSummary.total, commissions, selectedDetail]);

  const suggestedTemplates = useMemo(() => {
    if (!selectedOrder) return [];
    return templates.filter((template) => template.status === selectedOrder.current_status);
  }, [selectedOrder, templates]);

  async function copyMessage(template) {
    const message = renderTemplate(template.message, selectedOrder);
    await navigator.clipboard.writeText(message);
    setCopied(template.id);
    setTimeout(() => setCopied(""), 1200);
  }

  function openWhatsApp(template) {
    if (!selectedOrder) return;
    const message = encodeURIComponent(renderTemplate(template.message, selectedOrder));
    window.open(`https://wa.me/${selectedOrder.phone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  async function assignSelected(employeeId) {
    if (!selectedOrder) return;
    await api.assignOrder(selectedOrder.id, employeeId);
    await loadData();
  }

  async function markFollowed() {
    if (!selectedOrder) return;
    const employeeId = selectedOrder.assigned_employee_id || employees[0]?.id;
    if (!employeeId) return setError("Create an employee first.");
    await api.followup(selectedOrder.id, {
      employee_id: employeeId,
      action_type: "whatsapp_followup",
      note,
      next_action: "wait_customer_response",
    });
    setNote("");
    await loadData();
  }

  async function markRecovered() {
    if (!selectedOrder) return;
    await api.markRecovered(selectedOrder.id, { employee_id: selectedOrder.assigned_employee_id || employees[0]?.id });
    await loadData();
  }

  async function createEmployee(event) {
    event.preventDefault();
    await api.createEmployee(employeeDraft);
    setEmployeeDraft({ name: "", email: "", role: "recovery" });
    await loadData();
  }

  async function createTemplate(event) {
    event.preventDefault();
    await api.createTemplate(templateDraft);
    setTemplateDraft({ status: "Refusé", language: "darija", title: "", message: "" });
    await loadData();
  }

  async function signIn(event) {
    event.preventDefault();
    if (!authEnabled) return;
    await supabaseAuth.auth.signInWithOtp({ email });
    setEmail("");
  }

  return (
    <div className={`app ${theme} ${language === "ar" ? "rtl" : ""}`} dir={language === "ar" ? "rtl" : "ltr"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">CR</div>
          <div>
            <strong>{t.app}</strong>
            <span>Sendit recovery ops</span>
          </div>
        </div>
        <nav>
          {[
            ["dashboard", t.dashboard],
            ["recovery", t.recovery],
            ["commissions", t.commissions],
            ["templates", t.templates],
            ["settings", t.settings],
          ].map(([key, label]) => (
            <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Morocco COD operations</p>
            <h1>{t.app}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="toolbar">
            <button onClick={() => setLanguage(language === "fr" ? "ar" : "fr")}>{language === "fr" ? "AR" : "FR"}</button>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? t.dark : t.light}</button>
          </div>
        </header>

        {error && <div className="alert">{t.apiIssue}<br /><small>{error}</small></div>}
        {loading && <div className="panel padded">Loading...</div>}

        {view === "dashboard" && (
          <>
            <section className="metrics">
              <Metric label={t.actionOrders} value={metrics.actionOrders} tone="red" />
              <Metric label={t.followedToday} value={metrics.followedToday} tone="orange" />
              <Metric label={t.recovered} value={metrics.recovered} tone="green" />
              <Metric label={t.totalCommission} value={money(metrics.totalCommission)} tone="green" />
              <Metric label={t.recoveryRate} value={`${metrics.recoveryRate}%`} tone="gray" />
            </section>
            <RecoveryView
              t={t}
              filters={filters}
              setFilters={setFilters}
              employees={employees}
              orders={filteredOrders}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
              selectedDetail={selectedDetail}
              suggestedTemplates={suggestedTemplates}
              note={note}
              setNote={setNote}
              copied={copied}
              copyMessage={copyMessage}
              openWhatsApp={openWhatsApp}
              assignSelected={assignSelected}
              markFollowed={markFollowed}
              markRecovered={markRecovered}
            />
          </>
        )}

        {view === "recovery" && (
          <RecoveryView
            t={t}
            filters={filters}
            setFilters={setFilters}
            employees={employees}
            orders={filteredOrders}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            selectedDetail={selectedDetail}
            suggestedTemplates={suggestedTemplates}
            note={note}
            setNote={setNote}
            copied={copied}
            copyMessage={copyMessage}
            openWhatsApp={openWhatsApp}
            assignSelected={assignSelected}
            markFollowed={markFollowed}
            markRecovered={markRecovered}
          />
        )}

        {view === "commissions" && (
          <CommissionCenter t={t} commissions={commissions} summary={commissionSummary} refresh={loadData} />
        )}

        {view === "templates" && (
          <Templates t={t} templates={templates} draft={templateDraft} setDraft={setTemplateDraft} createTemplate={createTemplate} />
        )}

        {view === "settings" && (
          <Settings
            t={t}
            employees={employees}
            employeeDraft={employeeDraft}
            setEmployeeDraft={setEmployeeDraft}
            createEmployee={createEmployee}
            email={email}
            setEmail={setEmail}
            signIn={signIn}
          />
        )}
      </main>
    </div>
  );
}

function RecoveryView(props) {
  const { t, filters, setFilters, employees, orders, selectedOrder, setSelectedOrder, selectedDetail, suggestedTemplates, note, setNote, copied, copyMessage, openWhatsApp, assignSelected, markFollowed, markRecovered } = props;
  return (
    <section className="workArea">
      <div className="panel">
        <div className="panelHeader">
          <div>
            <h2>{t.recovery}</h2>
            <p>Only problematic Sendit orders are listed.</p>
          </div>
        </div>
        <div className="filters">
          <input placeholder={t.search} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">{t.status}: {t.all}</option>
            {PROBLEM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input placeholder={t.city} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
          <input placeholder={t.product} value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })} />
          <select value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
            <option value="">{t.employee}: {t.all}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>{t.customer}</th>
                <th>Phone</th>
                <th>{t.city}</th>
                <th>{t.product}</th>
                <th>Amount</th>
                <th>{t.status}</th>
                <th>Previous</th>
                <th>{t.employee}</th>
                <th>Attempts</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} className={selectedOrder?.id === order.id ? "selected" : ""}>
                  <td><strong>{order.sendit_order_id}</strong><span>{order.order_reference}</span></td>
                  <td>{order.customer_name}</td>
                  <td>{order.phone}</td>
                  <td>{order.city}</td>
                  <td>{order.product_name}</td>
                  <td>{money(order.amount)}</td>
                  <td><Status status={order.current_status} /></td>
                  <td>{order.previous_status}</td>
                  <td>{order.employees?.name || "Unassigned"}</td>
                  <td>{order.followup_attempts}</td>
                  <td>{order.last_status_update?.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length && <div className="empty">No recovery orders found.</div>}
        </div>
      </div>
      <OrderDrawer
        t={t}
        order={selectedOrder}
        detail={selectedDetail}
        employees={employees}
        templates={suggestedTemplates}
        note={note}
        setNote={setNote}
        copied={copied}
        copyMessage={copyMessage}
        openWhatsApp={openWhatsApp}
        assignSelected={assignSelected}
        markFollowed={markFollowed}
        markRecovered={markRecovered}
      />
    </section>
  );
}

function OrderDrawer({ t, order, detail, employees, templates, note, setNote, copied, copyMessage, openWhatsApp, assignSelected, markFollowed, markRecovered }) {
  if (!order) return <aside className="panel drawer padded">Select an order.</aside>;
  return (
    <aside className="panel drawer">
      <div className="drawerTop">
        <div>
          <p className="eyebrow">{t.orderDetail}</p>
          <h2>{order.sendit_order_id}</h2>
          <p>{order.customer_name} · {order.city}</p>
        </div>
        <Status status={order.current_status} />
      </div>

      <div className="infoGrid">
        <Info label="Phone" value={order.phone} />
        <Info label="Address" value={order.address} />
        <Info label={t.product} value={order.product_name} />
        <Info label="Amount" value={money(order.amount)} />
      </div>

      <label>{t.assign}</label>
      <select value={order.assigned_employee_id || ""} onChange={(e) => assignSelected(e.target.value)}>
        <option value="">Unassigned</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select>

      <div className="actionGrid">
        <button onClick={markFollowed}>{t.markFollowed}</button>
        <button className="primary" onClick={markRecovered}>{t.markRecovered}</button>
      </div>

      <section>
        <h3>{t.suggested}</h3>
        {templates.map((template) => (
          <article className="message" key={template.id}>
            <div>
              <strong>{template.title}</strong>
              <span>{template.language}</span>
            </div>
            <p>{renderTemplate(template.message, order)}</p>
            <div className="actionGrid">
              <button onClick={() => copyMessage(template)}>{copied === template.id ? "Copied" : t.copy}</button>
              <button onClick={() => openWhatsApp(template)}>{t.whatsapp}</button>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h3>{t.notes}</h3>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.addNote} />
        <button onClick={markFollowed}>{t.addNote}</button>
        {(detail?.followups || []).map((followup) => (
          <article className="note" key={followup.id}>
            <strong>{followup.action_type}</strong>
            <p>{followup.note}</p>
            <span>{followup.created_at?.slice(0, 16)}</span>
          </article>
        ))}
      </section>

      <section>
        <h3>{t.timeline}</h3>
        {(detail?.order_status_history || []).map((item) => (
          <div className="timelineItem" key={item.id}>
            <span />
            <div>
              <strong>{item.old_status || "New"} → {item.new_status}</strong>
              <small>{item.source} · {item.created_at?.slice(0, 16)}</small>
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}

function CommissionCenter({ t, commissions, summary, refresh }) {
  return (
    <section className="gridTwo">
      <div className="panel padded">
        <h2>{t.commissions}</h2>
        {(summary.byEmployee || []).map((item) => (
          <div className="rowCard" key={item.employee_id}>
            <strong>{item.name}</strong>
            <span>{item.count} recovered · {money(item.total)}</span>
          </div>
        ))}
      </div>
      <div className="panel padded">
        <h2>{t.pending} / {t.approved}</h2>
        {commissions.map((commission) => (
          <div className="rowCard" key={commission.id}>
            <div>
              <strong>{commission.employees?.name || "Employee"}</strong>
              <span>{commission.orders?.sendit_order_id} · {money(commission.amount)} · {commission.status}</span>
            </div>
            {commission.status !== "approved" && <button onClick={async () => { await api.approveCommission(commission.id); await refresh(); }}>{t.approve}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Templates({ t, templates, draft, setDraft, createTemplate }) {
  return (
    <section className="gridTwo">
      <form className="panel padded form" onSubmit={createTemplate}>
        <h2>{t.addTemplate}</h2>
        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          {PROBLEM_STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
          <option value="darija">Darija</option>
          <option value="french">French</option>
        </select>
        <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea placeholder="Message" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
        <button className="primary">{t.addTemplate}</button>
      </form>
      <div className="panel padded templateList">
        <h2>{t.templates}</h2>
        {templates.map((template) => (
          <article className="message" key={template.id}>
            <div><strong>{template.status}</strong><span>{template.language}</span></div>
            <h3>{template.title}</h3>
            <p>{template.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Settings({ t, employees, employeeDraft, setEmployeeDraft, createEmployee, email, setEmail, signIn }) {
  return (
    <section className="gridTwo">
      <form className="panel padded form" onSubmit={createEmployee}>
        <h2>{t.addEmployee}</h2>
        <input placeholder="Name" value={employeeDraft.name} onChange={(e) => setEmployeeDraft({ ...employeeDraft, name: e.target.value })} />
        <input placeholder="Email" value={employeeDraft.email} onChange={(e) => setEmployeeDraft({ ...employeeDraft, email: e.target.value })} />
        <input placeholder="Role" value={employeeDraft.role} onChange={(e) => setEmployeeDraft({ ...employeeDraft, role: e.target.value })} />
        <button className="primary">{t.addEmployee}</button>
        <p>Default commission: {COMMISSION_AMOUNT} MAD</p>
      </form>
      <div className="panel padded">
        <h2>{t.settings}</h2>
        {!authEnabled && <div className="alert">{t.authDisabled}</div>}
        {authEnabled && (
          <form className="form" onSubmit={signIn}>
            <input placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button>{t.signIn}</button>
          </form>
        )}
        {employees.map((employee) => (
          <div className="rowCard" key={employee.id}>
            <strong>{employee.name}</strong>
            <span>{employee.email} · {employee.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ status }) {
  const tone = status === "Livré" ? "green" : ["Refusé", "Injoignable"].includes(status) ? "red" : ["Annulé", "Retourné"].includes(status) ? "gray" : "orange";
  return <span className={`status ${tone}`}>{status}</span>;
}

function Info({ label, value }) {
  return <div className="info"><span>{label}</span><strong>{value || "-"}</strong></div>;
}
