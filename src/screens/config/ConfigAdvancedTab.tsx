import { useEffect, useState } from "react"
import { ConfigButtons, ResetBtn } from "../ConfigScreen"
import { settings } from "../../utils/variables"
import { IMAGES_FOLDERS } from "../../utils/constants"

const defaultConf = {
  imagesFolder: IMAGES_FOLDERS.image_x2,
}

const ConfigAdvancedTab = () => {
  const [conf, setConf] = useState({
    imagesFolder: settings.imagesFolder,
  })
  const [fullscreen, setFullscreen] = useState<boolean>(
    document.fullscreenElement !== null
  ) // don't save in settings

  useEffect(()=> {
    Object.assign(settings, conf)
  }, [conf])

  const updateValue = <T extends keyof typeof defaultConf>(
    key: T,
    value: typeof defaultConf[T]
  ) => setConf(prev => ({ ...prev, [key]: value }))

  const toggleFullscreen = () => {
    fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    setFullscreen(prev=> !prev)
  }

  return (
    <section>
      <ConfigButtons
        title="Quality"
        btns={[
          { text: `640\u00D7480`, value: IMAGES_FOLDERS.image },
          { text: `1280\u00D7960`, value: IMAGES_FOLDERS.image_x2 },
        ]}
        property="imagesFolder"
        conf={conf}
        updateValue={updateValue}
      />

      <ConfigButtons
        title="Fullscreen"
        btns={[
          { text: `On`, value: true },
          { text: `Off`, value: false },
        ]}
        property="fullscreen"
        conf={{fullscreen}}
        updateValue={toggleFullscreen}
      />

      <ResetBtn onClick={() => setConf(defaultConf)} />
    </section>
  )
}

export default ConfigAdvancedTab