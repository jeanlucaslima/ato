type Props = {
  total: number
  duplicates: number
  onCloseDuplicates: () => void
}

export default function StatsBar({ total, duplicates, onCloseDuplicates }: Props) {
  return (
    <div
      style={{
        fontSize: "12px",
        color: "#444",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "8px",
        gap: "8px"
      }}
    >
      <div>🧠 Tabs: {total}</div>
      {duplicates > 0 && (
        <button
          onClick={onCloseDuplicates}
          style={{
            fontSize: "12px",
            backgroundColor: "#eee",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "2px 6px",
            cursor: "pointer",
          }}
        >
          🗑 Close {duplicates} duplicate{duplicates > 1 ? "s" : ""}
        </button>
      )}
    </div>
  )
}
