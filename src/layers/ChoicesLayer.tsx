import { useEffect, useState } from "react"
import { Choice } from "../types"
import { displayMode, gameContext } from "../utils/variables"
import { observe, unobserve } from "../utils/Observer"
import script from "../utils/script"

const choicesContainer: {choices: Choice[]} = {
  choices: []
}

script.onChoices = (choices: Choice[])=> {
  if (choices.length > 1) {
    choicesContainer.choices = choices
    displayMode.choices = true;
    console.log(choices)
  } else if (choices.length == 1) {
    gameContext.label = choices[0].label
    console.log(choices[0])
  } else {
    console.error("no choice after scene", gameContext.label)
  }
}

const ChoicesLayer = () => {
  const [display, setDisplay] = useState<boolean>(displayMode.choices)
  const [choices, setChoices] = useState<Choice[]>([])

  useEffect(()=> {
    observe(displayMode, 'choices', setDisplay)
    observe(choicesContainer, 'choices', setChoices)
    return ()=> {
      unobserve(displayMode, 'choices', setDisplay)
      unobserve(choicesContainer, 'choices', setChoices)
    }
  }, [])

  const handleSelect = (choice: Choice) => {
    console.log(choice)
    gameContext.label = choice.label
    gameContext.index = 0
    displayMode.choices = false
  }

  return display ? (
    <div className="box box-choices">
      <div className="choices-container">
        {choices.map((choice: Choice, i:any) =>
          <button key={i} className="choice" onClick={()=> handleSelect(choice)}>
            {choice.str}
          </button>
        )}
      </div>
    </div>
  ) : (<></>)
}

export default ChoicesLayer