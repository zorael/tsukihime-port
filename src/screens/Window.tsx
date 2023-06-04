import { useContext, useEffect, useState } from 'react';
import '../styles/game.scss';
import AudioTsuki from '../utils/AudioTsuki';
import HistoryLayer from '../layers/HistoryLayer';
import { Background, Character, Choice, Line, Page } from '../types';
import { fetchChoices, fetchGoToNextScene, fetchScene, addEventListener } from '../utils/utils';
import ChoicesLayer from '../layers/ChoicesLayer';
import CharactersLayer from '../layers/CharactersLayer';
import TextLayer from '../layers/TextLayer';
import BackgroundLayer from '../layers/BackgroundLayer';
import { store } from '../context/GameContext';
import MenuLayer from '../layers/MenuLayer';
import { STRALIAS_JSON } from '../utils/constants';

const FIRST_SCENE = 20

const Window = () => {
  const { state, dispatch } = useContext(store)
  const [sceneNumber, setSceneNumber] = useState(402)
  const [scene, setScene] = useState<string[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [index, setIndex] = useState(0) //line
  const [text, setText] = useState<Line[]>([]) //current text
  const [pages, setPages] = useState<Page[]>([])
  const [bg, setBg] = useState<Background>({ image: '', type: ''})
  const [characters, setCharacters] = useState<Character[]>([])

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const sceneTmp = await fetchScene(sceneNumber)
    setScene(sceneTmp)
    const choicesTmp = await fetchChoices(sceneNumber)
    setChoices(choicesTmp)
  }

  //init
  useEffect(() => {
    if (scene.length !== 0) {
      let i = index
      do {
        if (scene[i] === "return") {
          dispatch({ type: 'SET_DISP_CHOICES', payload: true })
          return
        }
        processLine(scene[i])
  
        i++
      } while (!scene[i].startsWith('`'))
      setIndex(i)

      let lineHasEnded = true
      if (scene[i + 1] !== undefined && scene[i + 1].startsWith(' ')) {
        lineHasEnded = false
      }

      let newText: Line[] = []
      newText[0] = { line: scene[i], lineHasEnded: lineHasEnded, read: true }
      setText(newText)
    }
  }, [scene])

  const setNewScene = async (sceneNumber: number) => {
    setIndex(0)
    setText([])
    setSceneNumber(sceneNumber)
    const sceneTmp = await fetchScene(sceneNumber)
    setScene(sceneTmp)
    const choicesTmp = await fetchChoices(sceneNumber)
    setChoices(choicesTmp)
    dispatch({ type: 'SET_DISP_CHOICES', payload: false })
  }

  useEffect(() => {
    if (choices.length === 0 && state.dispChoices) {
      goToNextScene()
    }
  }, [state.dispChoices])

  const goToNextScene = async () => {
    const nextScene = await fetchGoToNextScene(sceneNumber)
    setNewScene(nextScene)
  }

  //on press enter, go to next line
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { //TODO: empêcher de laisser appuyé
        nextLine()
      }
      if (e.ctrlKey) {
        nextLine()
      }
    }
    return addEventListener({event: 'keydown', handler: handleKeyDown})
  })

  //on right click disp menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (e.button === 2 && !state.dispHistory) {
        dispatch({ type: 'SET_DISP_MENU', payload: !state.dispMenu })
      }
    }
    return addEventListener({event: 'contextmenu', handler: handleContextMenu})
  })
  
  //go to next line that starts with `
  const nextLine = () => {
    let i = index

    //check if previous line has ended
    if (text[text.length - 1].lineHasEnded) {
      do {
        if (scene[i] === "return") {
          dispatch({ type: 'SET_DISP_CHOICES', payload: true })
          return
        }
        processLine(scene[i])
        i++
      } while (!scene[i].startsWith('`'))
    } else {
      i++
    }
    setIndex(i)

    let lineHasEnded = true
    if (scene[i + 1] !== undefined && scene[i + 1].startsWith(' ')) {
      lineHasEnded = false
    }
    
    let newText: Line[] = text

    //if last line in history ends with \, reset text and add the page to pages
    const lastLine: string = text[text.length - 1].line
    if (lastLine !== undefined && lastLine[lastLine.length - 1] === '\\') {
      setPages([...pages, text])
      newText = []
    }

    const newLine = { line: scene[i], lineHasEnded: lineHasEnded, read: true }
    newText.push(newLine)
    setText(newText)
  }

  const processLine = (line: string) => {
    const prefix = line.split(' ')[0];

    switch(prefix) {
      case 'bg':
        foundBackground(line)
        break;
      case 'wave':
        foundWave(line)
        break;
      case 'waveloop':
        foundWaveLoop(line)
        break;
      case 'wavestop':
        foundWavestop(line)
        break;
      case 'br':
        foundBr()
        break;
      case 'ld':
        foundLd(line)
        break;
      case 'cl':
        foundCl(line)
        break;
    }
    
    function foundBackground(line: string) {
      const bgTmp: Background = {
        image: line.split('"')[1],
        type: line.split(',')[1].replace('%', '')
      }
      setBg(bgTmp)
    }

    function foundWave(line: string) {
      // wave se0
      let waveStr = line.split(' ')[1]
      new AudioTsuki(STRALIAS_JSON[waveStr])
    }

    function foundWaveLoop(line: string) {
      let waveStr = line.split(' ')[1]
      waveStr = STRALIAS_JSON[waveStr]
      // wave.handleAudio("play")
    }

    function foundWavestop(line: string) {
      // wave.handleAudio("stop")
    }

    function foundBr() {
      const newText: Line[] = text
      newText.push({ line: 'br' })
      setText(newText)
    }

    function foundLd(line: string) {
      //ld c,":a;image\tachi\stk_t01.jpg",%type_lshutter_fst
      const characterTmp: Character = {
        image: line.split(',')[1].split('"')[1].split(':a;')[1].replace('image\\tachi\\', '').replace('.jpg', ''),
        type: line.split(',')[2].replace('%', ''),
        pos: line.split(',')[0].replace('ld ', '')
      }

      //if there is already a character with the same position, replace it
      const index = characters.findIndex((c: Character) => c.pos === characterTmp.pos)
      if (index !== -1) {
        const newCharacters = characters
        newCharacters[index] = characterTmp
        setCharacters(newCharacters)
      } else {
        setCharacters([...characters, characterTmp])
      }
    }

    function foundCl(line: string) {
      const pos = line.split(',')[0].replace('cl ', '')
      const newCharacters = characters.filter((c: Character) => c.pos !== pos)
      setCharacters(newCharacters)
    }
  }

  const handleClick = () => {
    if (!state.dispChoices) {
      nextLine()
    }
  }

  return (
    <div className="window">
      <HistoryLayer pages={pages} text={text} />

      <BackgroundLayer bg={bg} />

      <CharactersLayer characters={characters} />

      <TextLayer text={text} handleClick={handleClick} />

      {state.dispChoices &&
        <ChoicesLayer choices={choices} setNewScene={setNewScene} />
      }

      <MenuLayer />
    </div>
  )
}

export default Window;