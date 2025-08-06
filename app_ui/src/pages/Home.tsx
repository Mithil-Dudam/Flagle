import { useEffect, useRef, useState } from "react"
import api from "../api"
import {MoveDown,MoveDownLeft,MoveDownRight,MoveLeft,MoveRight,MoveUp,MoveUpLeft,MoveUpRight} from "lucide-react"

function Home(){
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [error,setError] = useState<string|null>(null)
    const [guess,setGuess] = useState("")
    const [countries,setCountries] = useState<string[]|null>(null)
    const [dropdown,setDropdown] = useState(false)
    const [stop,setStop] = useState(false)
    const [result,setResult] = useState<{"result":string,"chunks":string[],"guesses":{"guess":string,"distance":string,"direction":string}[],"country":string,"lives":number}|null>(null)
    const [display,setDisplay] = useState(1)
    const [query,setQuery] = useState("")
    const [context,setContext] = useState<{"role":string,"text":string}[]|null>(null)
    const [spinner,setSpinner] = useState(false)

    const Generate = async () => {
        setError(null)
        try{
            await api.get("/random-country")
        }catch(error:any){
            setError("Couldnt generate a country's flag")
        }
    }

    const CountriesList = async () => {
        setError(null)
        try{
            const response = await api.post(`/countries-list?guess=${guess}`)
            if(response.status===200){
                setCountries(response.data.countries_list)
            }
        }catch(error:any){
            setError("Couldnt get list of countries")
        }
    }

    const Guess = async () => {
        setError(null)
        if(guess===""){
            setError("Enter a country.")
            return
        }
        try{
            const response = await api.post(`/guess?guess=${guess}`)
            if(response.status===200){
                setResult(response.data)
                setGuess("")
            }
        }catch(error:any)
        {
            if(error.response){
                setError(error.response.data.detail)
            }else{
                setError("Error: Couldnt check guess")
            }
        }
    }

    useEffect(()=>{
        if(guess.startsWith("/")){
            if(guess==="/AI"){
                setGuess("")
                setDisplay(2)
            }else{
                setError("Type '/AI' or a country's name")
            }
        }else{
            if(stop===false){
                CountriesList()
                if(guess!==""){
                    setError(null)
                    setDropdown(true)
                }else{
                    setDropdown(false)
                }
            }else{
                setDropdown(false)
            }
        }
    },[guess])

    useEffect(()=>{
        Generate()
    },[])

    const NewGame = async () => {
        setError(null)
        setGuess("")
        setCountries(null)
        setDropdown(false)
        setStop(false)
        setResult(null)
        Generate()
    }

    const SendQuery = async () => {
        setError(null)
        if(query===""){
            setError("Enter a query.")
            return
        }
        setSpinner(true)
        setContext((prev)=>(prev?[...prev,{"role":"user","text":query}]:[{"role":"user","text":query}]))
        try{
            const response = await api.post("/ai",{query})
            if(response.status===200){
                setContext((prev)=>(prev?[...prev,{"role":"AI","text":response.data.result}]:[{"role":"AI","text":response.data.result}]))
                setQuery("")
            }
        }catch(error:any){
            setError("Couldnt get response from AI")
        }finally{
            setSpinner(false)
        }
    }

    useEffect(()=>{
        if(query!==""){
            setError(null)
        }
    },[query])

    useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [context]);

    return(
        <div>
            {display===1 &&
            <div className="bg-black text-white w-screen h-screen overflow-auto">
                <h1 className="text-center pt-10 text-8xl font-bold"><span className="border-b-2">Flagle</span></h1>
                {result?.result==="correct"||result?.lives===0? 
                (<div className="mt-20">
                    <p className="text-center text-xl font-bold"><span className="border p-2 bg-green-500">{result.country.toUpperCase()}</span></p>
                </div>):""
                }
                <div className="my-20 border w-[640px] h-[427px] mx-auto grid grid-rows-2 grid-cols-3">
                    {result?.chunks?.map((chunk, i) => {
                        return (
                        <div
                            key={i}
                            className={`relative ${result.result==="correct"||result.lives===0?"":"border border-white border-dashed"}`}
                        >
                            {chunk===""?
                            (<div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold bg-gray-500" />
                            )
                            :(
                                <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold bg-black/30">
                                    <img src={chunk}/>
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
                {error&&
                <div>
                    <p className="text-red-500 text-center text-xl">{error}</p>    
                </div> }
                {result?.result==="correct"&&
                <div>
                    <p className="text-center text-xl font-semibold"><span className="border px-5 bg-green-500">You Guessed the Flag !</span></p>
                </div>
                }
                {result&&result.lives===0&&result.result!=="correct"&&
                <div>
                    <p className="text-center text-xl font-semibold"><span className="border px-5 bg-red-500">Out of Guesses!</span></p>
                </div>
                }
                <div className={`w-[70%] mx-auto flex border text-2xl ${dropdown?"mt-10":"my-10"}`}>
                    <input type="text" className="border w-full px-2" ref={inputRef} value={guess} onChange={(e)=>{
                        setGuess(e.target.value)
                        setStop(false)
                        }}
                        onKeyDown={async (e)=>{
                            if(e.key==="Enter"){
                                Guess()
                            }
                        }}
                        disabled={result?.result==="correct"||result?.lives===0}
                        placeholder="Enter a country or type'/AI' for a hint"
                        />
                    <button className="border py-1 px-3 font-semibold" onClick={Guess} disabled={result?.result==="correct"||result?.lives===0}>Guess</button>
                </div>
                {dropdown && countries&&
                <div className="border w-[70%] mx-auto">
                    <ul>
                        {countries?.map((country,index)=>(
                            <li key={index} className="hover:bg-gray-800 cursor-pointer" onClick={()=>{
                                setGuess(country)
                                setStop(true)
                                setTimeout(()=>inputRef.current?.focus(),0)
                                }}
                                >
                                {country}
                            </li>
                        ))}
                    </ul>
                </div>}
                <div className="w-[90%] mx-auto my-10 overflow-x-auto">
                    <table className="w-full table-auto border-collapse border border-gray-700 text-center">
                        <thead className="bg-gray-800 text-white text-xl">
                        <tr>
                            <th className="border border-gray-700 px-4 py-2">Guess</th>
                            <th className="border border-gray-700 px-4 py-2">Distance</th>
                            <th className="border border-gray-700 px-4 py-2">Direction</th>
                        </tr>
                        </thead>
                        <tbody className="text-lg">
                        {result?.guesses.map((guess, index) => (
                            <tr
                            key={index}
                            className={index % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}
                            >
                            <td className="border border-gray-700 px-4 py-2">{guess.guess}</td>
                            <td className="border border-gray-700 px-4 py-2">{parseFloat(guess.distance).toFixed(2)} kms</td>
                            <td className="border border-gray-700 px-4 py-2">
                                {guess.direction==="north"&&<MoveUp className="mx-auto"/>}
                                {guess.direction==="northeast"&&<MoveUpRight className="mx-auto"/>}
                                {guess.direction==="east"&&<MoveRight className="mx-auto"/>}
                                {guess.direction==="southeast"&&<MoveDownRight className="mx-auto"/>}
                                {guess.direction==="south"&&<MoveDown className="mx-auto"/>}
                                {guess.direction==="southwest"&&<MoveDownLeft className="mx-auto"/>}
                                {guess.direction==="west"&&<MoveLeft className="mx-auto"/>}
                                {guess.direction==="northwest"&&<MoveUpLeft className="mx-auto"/>}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                {result?.result==="correct"||result?.lives===0?
                (<div className="my-15 text-center">
                    <button className="border py-2 px-3 text-3xl font-semibold cursor-pointer bg-amber-500" onClick={NewGame}>Play Again</button>
                </div>):""
                }
            </div>
            }
            {display===2  &&
            <div className="bg-black w-screen h-screen text-white flex flex-col overflow-auto">
                <h1 className="text-center pt-10 text-7xl">Flagle AI</h1>
                <div className="border my-auto h-[80vh] mx-20 flex flex-col ">
                    <MoveLeft className="ml-5 my-auto cursor-pointer" onClick={()=>{
                        setQuery("")
                        setContext(null)
                        setError(null)
                        setDisplay(1)
                    }}/>
                    <div className="border h-[90%] bg-gray-200 overflow-auto" ref={chatContainerRef}>
                        {context?.map((convo,index)=>(
                            <div key={index} className={`my-5 text-xl ${convo.role==="user"?"text-right":"text-left"}`}>
                                <span className={`break-words whitespace-pre-wrap inline-block max-w-[80%] border-black border-2 ${convo.role==="user"?"bg-blue-800":"bg-green-800"} px-5 border rounded-full py-1`}>{convo.text}</span>
                            </div>
                        ))}
                    </div>
                    {spinner && (
                        <div className="flex justify-center items-center my-10">
                        <svg
                            className="animate-spin h-6 w-6 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            ></circle>
                            <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                            ></path>
                        </svg>
                        <p className="ml-2 text-white">Getting response...</p>
                        </div>
                    )}
                    <div className="my-auto">
                        <input type="text" className="border w-full text-xl px-1" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={async (e)=>{if(e.key==="Enter"){
                            SendQuery()
                        }}} placeholder="Enter your query..."/>
                    </div>
                </div>
                {error&&
                    <div className="my-10">
                        <p className="text-center text-red-500 font-semibold text-xl">{error}</p>
                    </div>
                }
            </div>
            }
        </div>
    )
}

export default Home