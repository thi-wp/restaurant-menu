'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './menu.module.css';

/* ─────────────────────────────────────────────────
   Types
───────────────────────────────────────────────── */
type Role = 'Manager' | 'Owner' | 'Waiter' | 'Cashier';

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
  description?: string;
}

interface Category {
  CategoryId: number;
  CategoryName: string;
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; icon: string }> = {
  Manager:  { label: 'Quản lý',      color: '#4f46e5', icon: '👑' },
  Owner:    { label: 'Chủ cửa hàng', color: '#7c3aed', icon: '🏠' },
  Waiter:   { label: 'Phục vụ',      color: '#0891b2', icon: '🧑‍🍳' },
  Cashier:  { label: 'Thu ngân',     color: '#0d9488', icon: '💳' },
};

const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

/* ─────────────────────────────────────────────────
   Toast notification
───────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType }

/* ─────────────────────────────────────────────────
   Component
───────────────────────────────────────────────── */
export default function MenuManagement() {

  /* ── Role simulation ──────────────────────── */
  const [currentRole, setCurrentRole] = useState<Role>('Manager');
  const isPrivileged = currentRole === 'Manager' || currentRole === 'Owner';

  /* ── Data state ───────────────────────────── */
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [dbError,     setDbError]     = useState<string | null>(null);

  /* ── Filters ──────────────────────────────── */
  const [search,          setSearch]          = useState('');
  const [filterCategory,  setFilterCategory]  = useState('Tất cả');
  const [filterAvail,     setFilterAvail]     = useState<'all' | 'available' | 'unavailable'>('all');

  /* ── Modal / Form ─────────────────────────── */
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingItem,  setEditingItem]  = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '', category: '', price: '', description: '', isAvailable: true,
  });
  const [formError,   setFormError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  /* ── Toasts ───────────────────────────────── */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── Fetch categories ─────────────────────── */
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: unknown) => {
        // Guard: chỉ dùng nếu server trả về array hợp lệ
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data as Category[]);
          setFormData(prev => ({ ...prev, category: (data[0] as Category).CategoryName }));
        }
      })
      .catch(() => {}); // categories load silently
  }, []);

  /* ── Fetch menu items ─────────────────────── */
  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: MenuItem[] = await res.json();
      setMenuItems(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setDbError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  /* ── Derived / filtered list ──────────────── */
  const filtered = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchCat    = filterCategory === 'Tất cả' || item.category === filterCategory;
      const matchAvail  =
        filterAvail === 'all' ||
        (filterAvail === 'available'   && item.isAvailable) ||
        (filterAvail === 'unavailable' && !item.isAvailable);
      return matchSearch && matchCat && matchAvail;
    });
  }, [menuItems, search, filterCategory, filterAvail]);

  /* ── Stats ────────────────────────────────── */
  const stats = useMemo(() => ({
    total:       menuItems.length,
    available:   menuItems.filter(i => i.isAvailable).length,
    unavailable: menuItems.filter(i => !i.isAvailable).length,
    categories:  new Set(menuItems.map(i => i.category)).size,
  }), [menuItems]);

  /* ── Modal helpers ────────────────────────── */
  const defaultCategory = categories[0]?.CategoryName ?? '';

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', category: defaultCategory, price: '', description: '', isAvailable: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name:        item.name,
      category:    item.category,
      price:       item.price.toString(),
      description: item.description ?? '',
      isAvailable: item.isAvailable,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingItem(null);
  };

  /* ── CRUD: Save (Create / Update) ────────── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim())    { setFormError('Vui lòng nhập tên món ăn.'); return; }
    if (!formData.category)       { setFormError('Vui lòng chọn danh mục.'); return; }
    const price = Number(formData.price);
    if (!formData.price || isNaN(price) || price < 1000) {
      setFormError('Giá bán phải ≥ 1.000 VND.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      name:         formData.name.trim(),
      categoryName: formData.category,
      price,
      description:  formData.description.trim(),
      isAvailable:  formData.isAvailable,
    };

    try {
      if (editingItem) {
        /* UPDATE */
        const res = await fetch(`/api/menu/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const updated: MenuItem = await res.json();
        setMenuItems(prev => prev.map(it => it.id === updated.id ? updated : it));
        addToast(`✅ Đã cập nhật "${updated.name}"`, 'success');
      } else {
        /* CREATE */
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const created: MenuItem = await res.json();
        setMenuItems(prev => [created, ...prev]);
        addToast(`✅ Đã thêm "${created.name}"`, 'success');
      }
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ── CRUD: Delete ─────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/menu/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json();
        addToast(`❌ ${e.error}`, 'error');
      } else {
        setMenuItems(prev => prev.filter(it => it.id !== deleteTarget.id));
        addToast(`🗑️ Đã xóa "${deleteTarget.name}"`, 'info');
      }
    } catch {
      addToast('❌ Lỗi mạng khi xóa.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* ── Toggle availability ──────────────────── */
  const toggleAvailability = async (item: MenuItem) => {
    if (!isPrivileged) return;
    const newVal = !item.isAvailable;

    // Optimistic update
    setMenuItems(prev => prev.map(it => it.id === item.id ? { ...it, isAvailable: newVal } : it));

    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newVal }),
      });
      if (!res.ok) {
        // Rollback
        setMenuItems(prev => prev.map(it => it.id === item.id ? { ...it, isAvailable: !newVal } : it));
        addToast('❌ Không thể cập nhật trạng thái.', 'error');
      } else {
        addToast(newVal ? `✅ "${item.name}" — Còn hàng` : `⚠️ "${item.name}" — Hết hàng`, 'info');
      }
    } catch {
      setMenuItems(prev => prev.map(it => it.id === item.id ? { ...it, isAvailable: !newVal } : it));
      addToast('❌ Lỗi mạng.', 'error');
    }
  };

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className={styles.page}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      {/* ── Toast stack ──────────────────────── */}
      <div className={styles.toastStack}>
        {toasts.map(t => (
          <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrand}>
            <div className={styles.brandIcon}>🍜</div>
            <div>
              <h1 className={styles.brandTitle}>Hệ Thống Quản Lý Quán Ăn</h1>
              <p className={styles.brandSub}>Restaurant Management System</p>
            </div>
          </div>

          <div className={styles.roleBar}>
            <span className={styles.roleLabel}>Quyền hiện tại:</span>
            <div className={styles.rolePills}>
              {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                <button
                  key={r}
                  id={`role-${r.toLowerCase()}`}
                  className={`${styles.rolePill} ${currentRole === r ? styles.rolePillActive : ''}`}
                  style={currentRole === r ? { '--role-color': ROLE_CONFIG[r].color } as React.CSSProperties : undefined}
                  onClick={() => setCurrentRole(r)}
                >
                  {ROLE_CONFIG[r].icon} {ROLE_CONFIG[r].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${styles.permBanner} ${isPrivileged ? styles.permBannerManager : styles.permBannerWaiter}`}>
          <span className={styles.permIcon}>{isPrivileged ? '🔓' : '🔒'}</span>
          {isPrivileged
            ? `Vai trò ${ROLE_CONFIG[currentRole].label}: Toàn quyền thêm, sửa và xóa dữ liệu thực đơn.`
            : `Vai trò ${ROLE_CONFIG[currentRole].label}: Chỉ có thể xem dữ liệu. Các chức năng chỉnh sửa đã bị vô hiệu hóa.`}
        </div>
      </header>

      {/* ══════════════════════════════════════
          MAIN
      ══════════════════════════════════════ */}
      <main className={styles.main}>

        {/* ── DB Error banner ─────────────── */}
        {dbError && (
          <div className={styles.dbErrorBanner}>
            <div className={styles.dbErrorIcon}>🔌</div>
            <div>
              <div className={styles.dbErrorTitle}>Không thể kết nối SQL Server</div>
              <div className={styles.dbErrorMsg}>{dbError}</div>
              <div className={styles.dbErrorHint}>
                Kiểm tra file <code>.env.local</code> — cấu hình <code>DB_SERVER</code>, <code>DB_NAME</code> và thông tin xác thực.
              </div>
            </div>
            <button className={styles.dbErrorRetry} onClick={fetchMenu}>🔄 Thử lại</button>
          </div>
        )}

        {/* ── Stats cards ─────────────────── */}
        <section className={styles.statsGrid} aria-label="Thống kê">
          {[
            { label: 'Tổng số món', value: stats.total,       icon: '🍽️', color: '#4f46e5' },
            { label: 'Còn phục vụ', value: stats.available,   icon: '✅', color: '#10b981' },
            { label: 'Tạm hết',     value: stats.unavailable, icon: '⚠️', color: '#f59e0b' },
            { label: 'Danh mục',    value: stats.categories,  icon: '📂', color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} className={styles.statCard} style={{ '--stat-color': s.color } as React.CSSProperties}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div>
                <div className={styles.statValue}>
                  {loading ? <span className={styles.skeletonNum} /> : s.value}
                </div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </section>

        {/* ── Toolbar ─────────────────────── */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                id="search-menu"
                type="text"
                className={styles.searchInput}
                placeholder="Tìm kiếm món ăn..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
              )}
            </div>

            <select
              id="filter-category"
              className={styles.select}
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="Tất cả">📂 Tất cả danh mục</option>
              {categories.map(c => (
                <option key={c.CategoryId} value={c.CategoryName}>{c.CategoryName}</option>
              ))}
            </select>

            <select
              id="filter-avail"
              className={styles.select}
              value={filterAvail}
              onChange={e => setFilterAvail(e.target.value as typeof filterAvail)}
            >
              <option value="all">🔵 Tất cả trạng thái</option>
              <option value="available">✅ Còn hàng</option>
              <option value="unavailable">⚠️ Hết hàng</option>
            </select>

            <button className={styles.btnRefresh} onClick={fetchMenu} disabled={loading} title="Tải lại từ DB">
              {loading ? '⏳' : '🔄'}
            </button>
          </div>

          <div className={styles.toolbarRight}>
            {isPrivileged ? (
              <button id="btn-add-menu" className={styles.btnAdd} onClick={openAddModal}>
                <span>＋</span> Thêm món mới
              </button>
            ) : (
              <div className={styles.noPermNote}>🔒 Không có quyền thêm món</div>
            )}
          </div>
        </div>

        {/* ── Table ───────────────────────── */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Tên món ăn</th>
                <th className={styles.th}>Danh mục</th>
                <th className={styles.th}>Giá bán</th>
                <th className={styles.th}>Trạng thái</th>
                <th className={`${styles.th} ${styles.thCenter}`}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* Loading skeleton rows */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={styles.tr}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className={styles.td}>
                        <div className={styles.skeletonRow} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyRow}>
                    <div className={styles.emptyBox}>
                      <div className={styles.emptyIcon}>{dbError ? '🔌' : '🍽️'}</div>
                      <div className={styles.emptyText}>
                        {dbError ? 'Chưa kết nối được database' : 'Không tìm thấy món ăn nào'}
                      </div>
                      <div className={styles.emptyHint}>
                        {dbError ? 'Kiểm tra .env.local và SQL Server' : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.itemName}>{item.name}</div>
                      {item.description && (
                        <div className={styles.itemDesc}>{item.description}</div>
                      )}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.categoryBadge}>{item.category}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.price}>{formatVND(item.price)}</span>
                    </td>
                    <td className={styles.td}>
                      <button
                        className={`${styles.availBadge} ${item.isAvailable ? styles.availOn : styles.availOff}`}
                        onClick={() => toggleAvailability(item)}
                        disabled={!isPrivileged}
                        title={isPrivileged ? 'Nhấn để đổi trạng thái' : 'Không có quyền'}
                      >
                        {item.isAvailable ? '✅ Còn hàng' : '⚠️ Hết hàng'}
                      </button>
                    </td>
                    <td className={`${styles.td} ${styles.tdCenter}`}>
                      {isPrivileged ? (
                        <div className={styles.actionGroup}>
                          <button
                            id={`btn-edit-${item.id}`}
                            className={styles.btnEdit}
                            onClick={() => openEditModal(item)}
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            id={`btn-delete-${item.id}`}
                            className={styles.btnDelete}
                            onClick={() => setDeleteTarget(item)}
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      ) : (
                        <span className={styles.noPermCell}>🔒 Không có quyền</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className={styles.tableFooter}>
            {loading
              ? 'Đang tải dữ liệu từ SQL Server...'
              : <>Hiển thị <strong>{filtered.length}</strong> / {menuItems.length} món ăn</>
            }
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════════ */}
      {isModalOpen && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div
            className={`${styles.modal} animate-slide-up`}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingItem ? '✏️ Cập Nhật Món Ăn' : '🍽️ Thêm Món Ăn Mới'}
              </h2>
              <button className={styles.modalClose} onClick={closeModal} disabled={saving}>✕</button>
            </div>

            <form onSubmit={handleSave} className={styles.form} noValidate>
              {formError && (
                <div className={styles.formError}>⚠️ {formError}</div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="f-name" className={styles.label}>
                  Tên món ăn <span className={styles.required}>*</span>
                </label>
                <input
                  id="f-name"
                  type="text"
                  className={styles.input}
                  placeholder="VD: Bò lúc lắc"
                  value={formData.name}
                  onChange={e => { setFormData({ ...formData, name: e.target.value }); setFormError(''); }}
                  autoFocus
                  disabled={saving}
                  required
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="f-category" className={styles.label}>Danh mục</label>
                  <select
                    id="f-category"
                    className={styles.input}
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    disabled={saving}
                  >
                    {categories.map(c => (
                      <option key={c.CategoryId} value={c.CategoryName}>{c.CategoryName}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="f-price" className={styles.label}>
                    Giá bán (VND) <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="f-price"
                    type="number"
                    className={styles.input}
                    placeholder="VD: 120000"
                    value={formData.price}
                    onChange={e => { setFormData({ ...formData, price: e.target.value }); setFormError(''); }}
                    min={1000}
                    disabled={saving}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="f-desc" className={styles.label}>Mô tả ngắn</label>
                <textarea
                  id="f-desc"
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="Mô tả nguyên liệu, cách chế biến..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  disabled={saving}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Trạng thái</label>
                <div className={styles.toggleRow}>
                  <button
                    type="button"
                    id="f-avail-on"
                    className={`${styles.toggleBtn} ${formData.isAvailable ? styles.toggleBtnOn : ''}`}
                    onClick={() => setFormData({ ...formData, isAvailable: true })}
                    disabled={saving}
                  >
                    ✅ Còn hàng
                  </button>
                  <button
                    type="button"
                    id="f-avail-off"
                    className={`${styles.toggleBtn} ${!formData.isAvailable ? styles.toggleBtnOff : ''}`}
                    onClick={() => setFormData({ ...formData, isAvailable: false })}
                    disabled={saving}
                  >
                    ⚠️ Hết hàng
                  </button>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancel} onClick={closeModal} disabled={saving}>
                  Hủy
                </button>
                <button type="submit" id="btn-save-form" className={styles.btnSave} disabled={saving}>
                  {saving ? '⏳ Đang lưu...' : editingItem ? '💾 Cập nhật' : '＋ Thêm món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          DELETE CONFIRM DIALOG
      ══════════════════════════════════════ */}
      {deleteTarget && (
        <div className={styles.backdrop} onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className={`${styles.modal} ${styles.modalSm} animate-slide-up`}
            onClick={e => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className={styles.deleteIcon}>🗑️</div>
            <h2 className={styles.deleteTitle}>Xác nhận xóa</h2>
            <p className={styles.deleteMsg}>
              Bạn có chắc muốn xóa món <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> khỏi thực đơn?
              Hành động này không thể hoàn tác.
            </p>
            <div className={styles.deleteActions}>
              <button className={styles.btnCancel} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Hủy bỏ
              </button>
              <button
                id="btn-confirm-delete"
                className={styles.btnDeleteConfirm}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '⏳ Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
