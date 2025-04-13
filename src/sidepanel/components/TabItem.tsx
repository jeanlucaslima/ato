import React from "react"
import DefaultFavicon from "./../icons/DefaultFavicon"
import CloseIcon from "./../icons/CloseIcon"

type TabItemProps = {
  tab: chrome.tabs.Tab
  isActive: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
}

export default function TabItem({ tab, isActive, onClick, onClose }: TabItemProps) {
  const [isHovering, setIsHovering] = React.useState(false)

  return (
    <li
      onClick={onClick}
      className={`tab-item ${
        isActive ? "tab-item--active" : ""
      } ${isHovering ? "tab-item--hover" : ""}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {tab.favIconUrl ? (
        <img src={tab.favIconUrl} alt="favicon" className="tab-item__favicon" />
      ) : (
        <DefaultFavicon />
      )}

      <div style={{ overflow: "hidden" }}>
        <div className="tab-item__title">{tab.title}</div>
        <div className="tab-item__url">{tab.url}</div>
      </div>

      <button
        onClick={onClose}
        className="tab-item__close"
        title="Close tab"
      >
        <CloseIcon />
      </button>
    </li>
  )
}
