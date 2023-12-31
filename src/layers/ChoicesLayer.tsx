import { useState } from "react"
import { Choice, LabelName, PageContent } from "../types"
import { gameContext } from "../utils/variables"
import { observe, useObserver } from "../utils/Observer"
import script from "../utils/script"
import { SCREEN, displayMode } from "../utils/display"
import history from "../utils/history"
import { preprocessText, resettable } from "../utils/utils"
import { Bbcode } from "../utils/Bbcode"

const [choicesContainer, resetChoices] = resettable({
  choices: [] as Choice[]
})

observe(displayMode, 'screen', resetChoices, {filter: s => s != SCREEN.WINDOW})


//##############################################################################
//#                                  COMMANDS                                  #
//##############################################################################

export const commands = {
  'select': (arg: string)=> {
    const choices: Choice[] = []
    const tokens = arg.split(/[`"],|(?<=\*\w+),/)
    for (let i = 0; i < tokens.length; i+= 2) {
      choices.push({
        index: i,
        str: preprocessText(tokens[i].trim().substring(1)), // remove '`' or '"'
        label: tokens[i+1].trim().substring(1) as LabelName // remove '*'
      })
    }
    if (choices.length == 0)
      console.error("no choice after scene", gameContext.label)
    choicesContainer.choices = choices
    displayMode.choice = true;
    console.debug(choices)
    history.onPageBreak("choice", choices)
    return {
      next: ()=>{}, // prevent continuing to next instruction
      cancel: ()=> { choicesContainer.choices = [] }
    }; // prevent processing next line
  }
}

//##############################################################################
//#                                 COMPONENT                                  #
//##############################################################################

const ChoicesLayer = () => {
  const [display, setDisplay] = useState<boolean>(false)
  const [choices, setChoices] = useState<Choice[]>([])

  function updateDisplay() {
    if (displayMode.choice && choicesContainer.choices.length == 0)
      displayMode.choice = false
    else setDisplay(displayMode.choice)
  }

  useObserver(updateDisplay, displayMode, 'choice')
  useObserver((choices)=> {
    setChoices(choices)
    updateDisplay()
  }, choicesContainer, 'choices')

  /*
  useObserver((screen)=> {
    if (screen != SCREEN.WINDOW)
      displayMode.choices = false // 'select' will be re-processed
  }, displayMode, 'screen')
  */

  const handleSelect = (choice: Choice) => {
    console.debug(choice)
    const lastPage = history.last?.page
    if (lastPage?.contentType == "choice")
      (lastPage as PageContent<"choice">).selected = choice.index
    script.moveTo(choice.label)
    choicesContainer.choices = []
  }

  return display ? (
    <div className="box box-choices">
      <div className="choices-container">
        {choices.map((choice: Choice, i:any) =>
          <button key={i} className="choice" onClick={()=> handleSelect(choice)}>
            <Bbcode text={choice.str}/>
          </button>
        )}
      </div>
    </div>
  ) : (<></>)
}

export default ChoicesLayer