import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";

export const Navbar = () => {
	const { store, actions } = useContext(Context)

	function logout() {
		actions.userLogout()
	}
	return (
		<nav className="navbar navbar-light bg-light">
			<div className="container">
				<Link to="/">
					<span className="navbar-brand mb-0 h1">React Boilerplate</span>
				</Link>
				{
					!!store.accessToken ?
						<div className="ml-auto">
							<button onClick={logout} className="btn btn-primary">Logout</button>
						</div>
						:
						<div className="ml-auto">
							<Link to="/recovery">
								<button className="btn btn-primary">Recovery Password</button>
							</Link>
						</div>
				}
			</div>
		</nav>
	);
};
