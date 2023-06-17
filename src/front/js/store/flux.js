import jwt_decode from "jwt-decode";

const apiUrl = process.env.BACKEND_URL
const getState = ({ getStore, getActions, setStore }) => {
	return {
		store: {
			message: null,
			pictureUrl: null,
			demo: [
				{
					title: "FIRST",
					background: "white",
					initial: "white"
				},
				{
					title: "SECOND",
					background: "white",
					initial: "white"
				}
			],
			favorites: {}
		},
		actions: {
			// Use getActions to call a function within a fuction
			addFavorite: (item) => {
				if (!favorites[item.id])
					favorites[item.id] = {
						name: item.name,
						picture: item.picture
					}
			},
			deleteFavorite: (item) => {
				if (favorites[item.id])
					delete favorites[item.id]
			},
			arrayFavorites: () => {
				let fav = getStore().favorites[id]
				let arr = Object.keys(favorites).map(id => ({
					id,
					...fav[id]
				}))
				return fav
			},
			exampleFunction: () => {
				getActions().changeColor(0, "green");
			},
			userLogin: async (email, password) => {
				const resp = await getActions().apiFetch("/login", "POST", { email, password })
				if (resp.code >= 400) {
					return resp
				}
				setStore({
					accessToken: resp.data.accessToken,
					refreshToken: resp.data.refreshToken,
					pictureUrl: resp.data.userInfo.profilePic
				})
				localStorage.setItem("accessToken", resp.data.accessToken)
				localStorage.setItem("refreshToken", resp.data.refreshToken)
				return resp
			},
			userLogout: async () => {
				const resp = await getActions().apiFetchProtected("/logout", "POST")
				if (resp.code >= 400) {
					return resp
				}
				setStore({
					accessToken: null,
					refreshToken: null,
					pictureUrl: null
				})
				localStorage.removeItem("accessToken")
				localStorage.removeItem("refreshToken")
				return resp
			},
			getMessage: async () => {
				try {
					// fetching data from the backend
					const resp = await getActions().apiFetch("/hello")
					setStore({ message: resp.data.message })
					// don't forget to return something, that is how the async resolves
					//return data.message;
				} catch (error) {
					console.log("Error loading message from backend", error)
				}
			},
			uploadProfilePic: async (formData) => {
				let resp = await fetch(apiUrl + "/profilepic", {
					method: "POST",
					body: formData,
					headers: {
						"Authorization": `Bearer ${getStore().accessToken}`
					}
				})
				if (!resp.ok) {
					console.error(`${resp.status}: ${resp.statusText}`)
					return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
				}
				let data = await resp.json()
				setStore({ profilePic: data.pictureUrl })
				return { code: resp.status, data }
			},
			requestPasswordRecovery: async (email) => {
				const resp = await getActions().apiFetch("/recoverypassword", "POST", { email })
				return resp
			},
			changePasswordRecovery: async (passwordToken, password) => {
				let resp = await fetch(apiUrl + "/changepassword", {
					method: "POST",
					body: JSON.stringify({ password }),
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${passwordToken}`
					}
				})
				if (!resp.ok) {
					console.error(`${resp.status}: ${resp.statusText}`)
					return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
				}
				let data = await resp.json()
				return { code: resp.status, data }
			},
			changeColor: (index, color) => {
				//get the store
				const store = getStore();

				//we have to loop the entire demo array to look for the respective index
				//and change its color
				const demo = store.demo.map((elm, i) => {
					if (i === index) elm.background = color;
					return elm;
				});

				//reset the global store
				setStore({ demo: demo });
			},
			apiFetch: async (endpoint, method = "GET", body = {}) => {
				let resp = await fetch(apiUrl + endpoint, method == "GET" ? undefined : {
					method,
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json"
					}
				})
				if (!resp.ok) {
					console.error(`${resp.status}: ${resp.statusText}`)
					return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
				}
				let data = await resp.json()
				return { code: resp.status, data }
			},
			apiFetchProtected: async (endpoint, method = "GET", body = {}) => {
				let params = {
					headers: {
						"Authorization": `Bearer ${getStore().accessToken}`
					}
				}
				if (method !== "GET") {
					params.method = method
					params.body = JSON.stringify(body)
					params.headers["Content-Type"] = "application/json"
				}
				let resp = await fetch(apiUrl + endpoint, params)
				let data = await resp.json()
				if (!resp.ok) {
					// Verificar si el token ha expirado
					if (data.msg == "Token has expired") {
						// Aqui se solicita un nuevo token de acceso
						await getActions().refreshToken()
						params.headers.Authorization = `Bearer ${getStore().accessToken}`

						// Se repite la peticion con el token nuevo
						resp = await fetch(apiUrl + endpoint, params)
						data = await resp.json()
						if (!resp.ok) {
							console.error(`${resp.status}: ${resp.statusText}`)
							return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
						}
					} else {
						console.error(`${resp.status}: ${resp.statusText}`)
						return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
					}
				}
				return { code: resp.status, data }
			},
			loadToken: async () => {
				let accessToken = localStorage.getItem("accessToken")
				let refreshToken = localStorage.getItem("refreshToken")
				if (!accessToken) {
					if (refreshToken) {
						var refreshDecoded = jwt_decode(refreshToken)
						let refreshExpired = new Date(refreshDecoded.exp * 1000) < new Date()
						if (refreshExpired) {
							localStorage.removeItem("accessToken")
							localStorage.removeItem("refreshToken")
							return
						}
					}
				}
				setStore({
					accessToken: accessToken,
					refreshToken: refreshToken
				})
				// Puedo verificar la vigencia del token antes de cargarlo al store
				let expired=true
				try{
					var decoded = jwt_decode(accessToken)
					expired = new Date(decoded.exp * 1000) < new Date()
				}catch{

				}
				console.log({ expired })
				if (expired) {
					await getActions().refreshToken()
				}
			},
			refreshToken: async () => {
				let resp = await fetch(apiUrl + "/refresh", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": "Bearer " + getStore().refreshToken
					}
				})
				if (!resp.ok) {
					console.error(`${resp.status}: ${resp.statusText}`)
					return { code: resp.status, error: `${resp.status}: ${resp.statusText}` }
				}
				let data = await resp.json()
				setStore({
					accessToken: data.accessToken,
					refreshToken: data.refreshToken
				})
				localStorage.setItem("accessToken", data.accessToken)
				localStorage.setItem("refreshToken", data.refreshToken)
			}
		}
	};
};

export default getState;
