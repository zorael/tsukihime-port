export const addEventListener = ({event, handler, element = window}: any) => {
  element.addEventListener(event, handler)
  return () => element.removeEventListener(event, handler)
}

export function convertText(text: string, props: Record<string, any> = {}): JSX.Element {

  if (text == "br")
    text = ""
  else if ( text.length > 0) {
    //remove '`', '@' and '\', EDIT : already removed by script parser
    //replace '|' with '…'
    text = text//.replace(/[`@\\]|(\!w\d+\b)/g, '')
               .replaceAll('|', '…')
  }
  return <span {...props}>{replaceDashes(text)}</span>
}

export function objectMatch(toTest: Record<PropertyKey, any>, minKeys: Record<PropertyKey, any>, useSymbols=true): boolean {
  const props = [
      ...Object.getOwnPropertyNames(minKeys),
      ...(useSymbols ? Object.getOwnPropertySymbols(minKeys) : [])]
	for(const p of props) {
    if (!(p in toTest))
      return false
		if(minKeys[p] !== toTest[p]) {
      if (minKeys[p].constructor != toTest[p].constructor)
        return false
      if (minKeys[p].constructor != Object && minKeys[p].constructor != Array)
        return false
      if (!objectMatch(toTest[p], minKeys[p], useSymbols))
        return false
    }
	}
	return true;
}

export function objectsEqual(obj1: Record<PropertyKey, any>, obj2: Record<PropertyKey, any>, useSymbols=true) {
	return objectMatch(obj1, obj2, useSymbols) && objectMatch(obj2, obj1, useSymbols)
}

export function overrideAttributes(dest: Record<PropertyKey, any>, src: Record<PropertyKey, any>, useSymbols=true) {
  const props = [
    ...Object.getOwnPropertyNames(src),
    ...(useSymbols ? Object.getOwnPropertySymbols(src) : [])]

  for (const p of props) {
    if (src[p]?.constructor == Object) { // deep-copy objects
      if (dest[p]?.constructor != Object)
        dest[p] = {}
      overrideAttributes(dest[p], src[p], useSymbols)
    } else if (src[p]?.constructor == Array) { // copy arrays
      dest[p] = src[p].slice(0, src[p].length)
    } else { // use same value/ref for other attributes
      dest[p] = src[p]
    }
  }
  return dest
}

export function deepFreeze<T extends Record<PropertyKey, any>>(object: T): Readonly<T> {
  const props = Reflect.ownKeys(object)
  for (const p of props) {
    const value = object[p]
    if (value && ["object", "function"].includes(typeof value))
      deepFreeze(value)
  }
  return Object.freeze(object)
}

export function isDigit(str: string, index: number = 0) {
  const char = str.charAt(index)
  return char >= '0' && char <= '9'
}

/**
 * Let the user download the text in a text file
 * @param text content of the file to download
 * @param fileName default name of the file
 */
export function textFileUserDownload(text: string, fileName: string) {
	let element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', fileName);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

/**
 * requests one or multiple files from the user
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
 * for more details on the {@link multiple} and {@link accept} parameters
 */
export function requestFilesFromUser({ multiple = false, accept = '' }): Promise<File|File[]|null> {
	return new Promise(((resolve) => {
		const input = document.createElement('input');
		input.setAttribute("type", "file");

		if (accept?.length > 0)
			input.setAttribute("accept", accept);

		if (multiple)
			input.toggleAttribute("multiple", true);

		input.addEventListener("change", ()=> {
			resolve(input.files as File|File[]|null);
		})
		input.click();
	}));
}

function bbcodeTagToJSX({tag: Tag, arg, content}: {tag: string, arg: string, content: JSX.Element[]}) {
  switch(Tag) {
    case 'b' :
    case 'i' :
    case 's' :
    case 'sup' :
    case 'sub' : return <Tag>{...content}</Tag>
    case 'u' : return <span style={{textDecoration: "underline"}}>{...content}</span>
    case 'size' : return <span style={{fontSize: arg}}>{...content}</span>
    case 'color' : return <span style={{color: arg}}>{...content}</span>
    case 'center':
    case 'left':
    case 'right': return <div style={{textAlign: Tag}}>{...content}</div>
    case 'url': return <a href={arg}>{...content}</a>
    default :
      throw Error(`Unknown bbcode tag ${Tag}`)
  }
}

function replaceDashes(text: string): JSX.Element {
    const nodes: Array<JSX.Element|string> = []
    //replace consecutive dashes with a continuous line
    let m
    while ((m = /-{2,}/g.exec(text)) !== null) {
      if (m.index > 0)
        nodes.push(text.substring(0, m.index))
      const len = m[0].length
      nodes.push(<span className="dash" dash-size={len}>
          {"\u{2002}".repeat(len) /*en-dash-sized space*/}
        </span>)
      text = text.substring(m.index + len)
    }
    if (text.length > 0)
      nodes.push(text)
    return <>{...nodes}</>
}

//[/?<tag>=<arg>] not preceded by a '\'
const bbcodeTagRegex = /(?<!\\)\[(?<tag>\/?\w+)(=(?<arg>[^\]]+))?\]/g
/**
 * convert text with BB code to JSX nodes
 */
export function parseBBcode(text: string): JSX.Element {
  const nodes = [{tag:"", arg: "", content:[] as JSX.Element[]}]
  let lastIndex = 0
  let m
  while(((m = bbcodeTagRegex.exec(text))) !== null) {
    let {tag, arg} = m.groups ?? {}
    const currNode = nodes[nodes.length-1]
    const subText = text.substring(lastIndex, m.index)
    currNode.content.push(replaceDashes(subText))
    lastIndex = bbcodeTagRegex.lastIndex
    if (tag.startsWith('/')) {
      if (tag.substring(1) != currNode?.tag)
        throw Error(`Unmatched [${tag}] in "${text}"`)
      nodes.pop()
      const prevNode = nodes[nodes.length-1]
      prevNode.content.push(bbcodeTagToJSX(currNode))
    } else {
      nodes.push({tag, arg, content:[]})
    }
  }
  if (lastIndex == 0) // no bbcode
    return replaceDashes(text)
  if (lastIndex < text.length) //
    nodes[nodes.length-1].content.push(replaceDashes(text.substring(lastIndex)))
  while (nodes.length > 1) {
    const currNode = nodes.pop() as typeof nodes[0]
    const prevNode = nodes[nodes.length-1]
    prevNode.content.push(bbcodeTagToJSX(currNode))
  }
  return <>{...nodes[0].content}</>
}

export function toggleFullscreen() {
  if (isFullscreen())
    document.exitFullscreen()
  else
    document.documentElement.requestFullscreen()
}

export function isFullscreen() {
  return document.fullscreenElement !== null
}