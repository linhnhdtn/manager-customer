interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  value: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  value,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: 600 }}>
          Confirm Bulk Update
        </h2>
        <p style={{ margin: "0 0 24px 0", color: "#6d7175", fontSize: "14px", lineHeight: "1.6" }}>
          Are you sure you want to update the value <strong style={{ color: "#202223" }}>{value}</strong> for <strong style={{ color: "#202223" }}>ALL</strong> customers?
          <br /><br />
          This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid #c9cccf",
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: "#202223",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f6f6f7")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: "10px 20px",
              border: "1px solid #d82c0d",
              borderRadius: "4px",
              backgroundColor: "#d82c0d",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#bf2600")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d82c0d")}
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
}
