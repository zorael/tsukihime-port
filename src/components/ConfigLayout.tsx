import { ReactNode, useEffect, useState } from 'react'
import '../styles/config.scss'
import ConfigMainTab from '../components/config/ConfigMainTab'
import ConfigAdultTab from '../components/config/ConfigAdultTab'
import ConfigAdvancedTab from '../components/config/ConfigAdvancedTab'
import ConfigControlsTab from '../components/config/ConfigControlsTab'
import strings, { useLanguageRefresh } from '../utils/lang'
import TabsComponent from '../components/TabsComponent'
import { SCREEN } from '../utils/display'

enum Tabs {
  main = "Main",
  adult = "Adult",
  controls = "Controls",
  advanced = "Advanced",
}

const tabComponents = {
  [Tabs.main]: <ConfigMainTab />,
  [Tabs.adult]: <ConfigAdultTab />,
  [Tabs.controls]: <ConfigControlsTab />,
  [Tabs.advanced]: <ConfigAdvancedTab />,
}

type Props = {
  back: ()=>void,
  selectedTab?: Tabs,
  setUrl?: (activeTab: string)=>void,
  page?: string,
}

const ConfigLayout = ({back, selectedTab, setUrl, page}: Props) => {
  const [activeTab, setActiveTab] = useState(selectedTab || Tabs.main)
  useLanguageRefresh()

  useEffect(()=> {
    if (!Object.hasOwn(tabComponents, activeTab))
      setActiveTab(Tabs.main)
    else if (setUrl)
      setUrl(activeTab)
  }, [activeTab])

  const tabs = page === SCREEN.CONFIG
                ? Object.values(Tabs)
                : Object.values(Tabs).filter(t => t !== Tabs.advanced)

  return (
    <div id="config-layout">
      <h2 className="page-title">{strings.menu.config}</h2>

      <TabsComponent tabs={tabs}
        selected={activeTab} setSelected={setActiveTab} />

      {tabComponents[activeTab]}

      <button className="menu-btn back-button" onClick={back.bind(null)}>
        {strings.back}
      </button>
    </div>
  )
}

export default ConfigLayout


interface ConfigLayoutProps {
  title: string
  desc?: ReactNode
  children: ReactNode
  [key:string]:any
}
export const ConfigItem = ({ title, desc, children, ...props }: ConfigLayoutProps) => (
  <div className="config" {...props}>
    <div className="config-name">{title}</div>

    <div className="config-actions">
      {children}

      {desc &&
      <div className="desc">
        {desc}
      </div>
      }
    </div>
  </div>
)

interface ConfigButtonsProps {
  title: string
  desc?: ReactNode
  btns: { text: string; value: any }[]
  property: string
  conf: Record<string, any>
  updateValue: (key: any, value: any) => void
}
/** Display multiples options to choose from */
export const ConfigButtons = ({title, desc, btns, property, conf, updateValue}: ConfigButtonsProps) => (
  <ConfigItem title={title} desc={desc}>
    <div className="config-btns">
      {btns.map(({text, value}) =>
        <button
          key={text}
          className={`config-btn ${conf[property] === value ? 'active' : ''}`}
          onClick={() => updateValue(property, value)}>
          {text}
        </button>
      )}
    </div>
  </ConfigItem>
)

export const ResetBtn = ({onClick}: {onClick: ()=> void}) => (
  <div className="reset">
    <button className="menu-btn reset" onClick={onClick}>{strings.config.reset}</button>
  </div>
)