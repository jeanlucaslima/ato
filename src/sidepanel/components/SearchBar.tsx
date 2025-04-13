type Props = {
  value: string
  onChange: (val: string) => void
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <input
        type="text"
        placeholder="Search tabs..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 8px",
          fontSize: "14px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          boxSizing: "border-box"
        }}
      />
    </div>
  )
}
