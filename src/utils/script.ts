import { commands as choiceCommands } from "../layers/ChoicesLayer"
import { commands as graphicCommands } from "../layers/GraphicsLayer"
import { commands as textCommands } from "../layers/TextLayer"
import { LabelName, Page, RouteDayName, RouteName, SceneName } from "../types"
import { commands as audioCommands } from "./AudioManager"
import { observe } from "./Observer"
import history from "./history"
import { SCENE_ATTRS } from "./constants"
import Timer, { commands as timerCommands } from "./timer"
import { checkIfCondition, extractInstructions, fetchFBlock, fetchScene, getPhaseDetails, getSceneTitle, isScene } from "./scriptUtils"
import { commands as variableCommands, gameContext, settings, displayMode, SCREEN } from "./variables"
type Instruction = {cmd: string, arg: string}
type CommandHandler = {next: VoidFunction, autoPlayDelay?: number}
type CommandProcessFunction =
    ((arg: string, cmd: string, onFinish: VoidFunction)=>CommandHandler|Instruction[]|void)
type CommandMap = Map<string, CommandProcessFunction|null>

type SkipCallback = (sceneTitle: string|undefined, confirm:(skip: boolean)=>void)=>void
let skipCallback: SkipCallback = ()=> { throw Error(`script.onSkipPrompt not specified`) }

const pageChangeListeners = new Array<VoidFunction>()

let sceneLines: Array<string> = []
let lastLine = {label: "", index: 0}
let currentCommand: CommandHandler | undefined
let skipCommand: VoidFunction | undefined
let lineSkipped: boolean = false
let autoPlay: boolean = false

const LOCK_CMD = {next: ()=>{}} // prevent proceeding to next line

export const script = {
  /**
   * Set the callback to call when a scene can be skipped
   */
  set onSkipPrompt(callback: SkipCallback) {
    skipCallback = callback
  },
  /**
   * function to call to move to the next step of the current command.
   * Most commands will interpet it as a "skip".
   */
  next(): void {
    if (currentCommand)
      currentCommand.next()
  },

  set autoPlay(enable: boolean) {
    autoPlay = enable
  },

  get autoPlay() {
    return autoPlay
  },

  get currentLine() {
    return sceneLines[gameContext.index]
  },

  moveTo(label: LabelName|'', index: number = -1) {
    gameContext.label = label
    gameContext.index = index
  }
}
export default script

function processPhase(dir: "l"|"r") {
  const {bg, route, routeDay, day} = getPhaseDetails()
  gameContext.phase.route = route
  gameContext.phase.routeDay = routeDay
  gameContext.phase.day = day
  const invDir = dir=='l'?'r':'l';
  return [
    ...extractInstructions(`bg ${bg},%type_${dir}cartain_fst`),
    ...extractInstructions(`ld ${dir},$${route}|${routeDay},%type_${invDir}cartain_fst`),
    ...(day ? extractInstructions(`ld ${dir},$${route}|${routeDay}|${day},%type_crossfade_fst`) : []),
    {cmd: "click", arg: Math.max(500, settings.nextPageDelay).toString()},
    ...extractInstructions(`bg #000000,%type_crossfade_fst`)
  ];
}

//##############################################################################
//#                                  COMMANDS                                  #
//##############################################################################

let commands:CommandMap|undefined;
function buildCommands() {
  commands = new Map(Object.entries<CommandProcessFunction|null>({

    ...textCommands,
    ...graphicCommands,
    ...audioCommands,
    ...timerCommands,
    ...variableCommands,
    ...choiceCommands,

    'if'        : processIfCmd,
    'goto'      : processGoto,
    'gosub'     : processGosub,

    'skip'      : (n: string)=> { gameContext.index += parseInt(n) },
    'return'    : ()=> { onSceneEnd(); return LOCK_CMD },
    'click'     : processClick,

    ...Object.fromEntries([ // ignored commands
      'setwindow', 'windoweffect',
      'setcursor', 'autoclick',
      '*', '!s',
    ].map(cmd=>[cmd, null]))
  })) as CommandMap
}

function processIfCmd(arg: string, _: string) {
  let index = arg.search(/ [a-z]/)
  if (index == -1)
    throw Error(`no separation between condition and command: "if ${arg}"`)
  const condition = arg.substring(0, index)
  if (checkIfCondition(condition))
    return extractInstructions(arg.substring(index+1))
}

function processGoto(arg: string) {
  if (/^\*f\d+a?$/.test(arg)) {
    script.moveTo(arg.substring(1) as LabelName, 0)
    return LOCK_CMD // prevent processing next line
  } else if (arg == "*endofplay") {
    //TODO end session, return to title screen
  }
}

function processGosub(arg: string, _: string) {
  if (arg == "*right_phase" || arg == "*left_phase") {
    //display phase transition
    return processPhase((arg == "*left_phase") ? "l" : "r")
  } else if (arg == "*ending") {
    // ending is called from the scene. If necessary, set the scene
    // as completed before jumping to ending
  } else if (isScene(arg)) {
    script.moveTo(arg.substring(1) as SceneName)
    return LOCK_CMD
  }
}

function processClick(arg: string, _: string, onFinish: VoidFunction) {
  if (arg.length > 0) {
    // inserted a delay in the `click` argument. (Not standard Nscripter).
    const delay = parseInt(arg)
    return { next: onFinish, autoPlayDelay: delay }
  } else {
    return { next: onFinish }
  }
}

//##############################################################################
//#                            EXECUTE SCRIPT LINES                            #
//##############################################################################
/**
 * Exclusively used by the {@link processLine} function to handle
 * command results
 * @param commandResult
 * @param onFinish
 */
function processCommandResult(commandResult: CommandHandler,
                              onFinish: VoidFunction) {
  currentCommand = commandResult
  if (autoPlay && typeof commandResult.autoPlayDelay == "number") {
    const next = commandResult.next.bind(commandResult)
    const timer = new Timer(commandResult.autoPlayDelay, ()=> {
      if (autoPlay) // check if 'autoPlay' changed while the timer was running
        next()
    })
    timer.start()
    currentCommand.next = timer.skip.bind(timer)
    skipCommand = ()=> {
      timer.cancel()
      onFinish()
    }
  } else {
    skipCommand = onFinish // if the command must be skipped at some point
  }
}
/**
 * Execute the script line. Extract the command name and arguments from the line,
 * and calls the appropriate function to process it.
 * Update currentCommand.
 * @param line the script line to process
 * @param onFinish callback function called when the line has been processed
 */
export async function processLine(line: string) {
  const instructions = extractInstructions(line)
  for (let i=0; i< instructions.length; i++) {
    const {cmd, arg} = instructions[i]
    if (lineSkipped)
      break

    if (!commands)
      buildCommands()

    const command = commands?.get(cmd)
    if (command) {
      await new Promise<void>(resolve=> {
        let commandResult = command(arg, cmd, resolve)
        if (Array.isArray(commandResult)) {
          instructions.splice(i+1, 0, ...commandResult)
          currentCommand = undefined
          resolve()
        } else if (commandResult) {
          processCommandResult(commandResult, resolve)
        } else
          resolve()
      })
      currentCommand = undefined
      skipCommand = undefined
    }
    else if (!commands?.has(cmd)) {
      const {label: scene, index} = gameContext
      console.error(`unknown command ${scene}:${index}: ${line}`)
      debugger
    }
  }
}

/**
 * Executed when {@link gameContext.index} is modified,
 * when the scene is loaded, or when the screen changes.
 * Calls the execution of the command at the current line index
 * in the scene file
 */
async function processCurrentLine() {
  const {index, label} = gameContext
  const lines = sceneLines
  if (index < 0 || // no valid line index
      label.length == 0 || // no specified scene
      lines.length == 0 || // scene not loaded
      displayMode.screen != SCREEN.WINDOW) // not in the right screen
    return

  if (currentCommand) {
    if (lastLine.index == index &&
        lastLine.label == label)
      return
    // Index has been changed by outside this function.
    // Skip remaining instructions in the previous line.
    // Resolve the promise of the ongoing command.
    lineSkipped = true
    skipCommand?.()
    // Process the current line after aborting the previous line
    setTimeout(processCurrentLine, 0)
    return
  }

  lastLine.index = index
  lastLine.label = label
  if (index < lines.length) {
    if (isScene(label) && (index == 0 || lines[index-1].endsWith('\\')))
      history.onPageBreak()

    let line = sceneLines[index]
    console.log(`${label}:${index}: ${line}`)
    await processLine(line)
    if (gameContext.index != index || gameContext.label != label) {
      // the context has been changed while processing the line.
      // processCurrentLine() will be called again by the observer.
      // The index should not be incremented
      lineSkipped = false
    } else {
      gameContext.index++
    }
  } else {
    onSceneEnd()
  }
}

async function fetchSceneLines() {
  const label = gameContext.label
  let fetchedLines: string[]|undefined = undefined
  if (isScene(label))
    fetchedLines = await fetchScene(label)
  else if (/^(f|skip)\d+a?$/.test(label))
    fetchedLines = await fetchFBlock(label)

  if (fetchedLines == undefined)
    throw Error(`error while fetching lines for label ${label}`)
  // check if context was changed while fetching the file
  if (label == gameContext.label) {
    sceneLines = fetchedLines
    processCurrentLine()
  }
}

/**
 * Executed when {@link gameContext.label} is modified.
 * Loads the scene or script block and starts the execution of lines.
 * {@link gameContext.index} is not modified.
 * To start from line 0, set {@link gameContext.index} to 0.
 * @param label id of the scene or block to load.
 */
async function loadLabel(label: LabelName|"") {
  console.log(`load label ${label}`)
  sceneLines = [] // set to empty to prevent execution of previous scene
  if (gameContext.index == -1)
    onSceneStart()
  else if (label != "")
    fetchSceneLines()
}

function onSceneEnd(label = gameContext.label) {
  console.log(`ending ${label}`)
  if (isScene(label)) {
    // add scene to completed scenes
    if (!settings.completedScenes.includes(label))
      settings.completedScenes.push(label)
    if (/^s\d+a?$/.test(label))
      script.moveTo(`skip${label.substring(1)}` as LabelName)
    else if (label == "openning")
      script.moveTo('s20')
    else {
      //TODO back to title
    }
  }
}

function warnHScene(callback: VoidFunction) {
  alert("You are about to read an H-scene. Beware of your surroundings.")
  callback()
}

function onSceneStart() {
  const label = gameContext.label as SceneName
  if (settings.enableSceneSkip && settings.completedScenes.includes(label)) {
    skipCallback(getSceneTitle(label), async skip=> {
      if (skip)
        onSceneEnd(label)
      else {
        // check if context was changed while asking user
        if (label == gameContext.label) {
          gameContext.index = 0
          fetchSceneLines()
        }
      }
    })
  } else if (settings.warnHScenes && SCENE_ATTRS.scenes[label]?.h) {
    warnHScene(()=> {
      gameContext.index = 0
      fetchSceneLines()
    })
  } else {
    gameContext.index = 0
    fetchSceneLines()
  }
}

observe(gameContext, 'label', loadLabel)
observe(gameContext, 'index', processCurrentLine)
observe(displayMode, 'screen', (screen)=> {
  if (screen == SCREEN.WINDOW)
    processCurrentLine()
  else {
    //clear values not in gameContext
    currentCommand = undefined
  }
})

//##############################################################################
//#                                   DEBUG                                    #
//##############################################################################

window.script = script
