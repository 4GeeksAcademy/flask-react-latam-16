import React, { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import rigoImageUrl from "../../img/rigo-baby.jpg";


export const Single = props => {
	const { store, actions } = useContext(Context);
	const navigate = useNavigate()
	const params = useParams();
	useEffect(() => {
		if (!store.accessToken) navigate("/")
	}, [store.accessToken])

	async function submitForm(e) {
		e.preventDefault()
		const formData = new FormData(e.target)
		let resp = await actions.uploadProfilePic(formData)
		console.log(resp.code)
	}

	return (
		<div className="jumbotron">
			<h1 className="display-4">User Profile</h1>
			<img src={store.pictureUrl} />
			<hr className="my-4" />
			<form onSubmit={submitForm}>
				<div className="mb-3">
					<label htmlFor="formFile" className="form-label">Default file input example</label>
					<input className="form-control" type="file" name="profilePic" id="formFile" />
				</div>
				<button className="btn btn-primary" type="submit">Update picture</button>
			</form>
		</div>
	);
};

Single.propTypes = {
	match: PropTypes.object
};
