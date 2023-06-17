import React, { useContext } from "react";
import { Context } from "../store/appContext";
import rigoImageUrl from "../../img/rigo-baby.jpg";
import "../../styles/home.css";
import { useSearchParams } from "react-router-dom";

export const ChangePassword = () => {
    const { store, actions } = useContext(Context);
    let [searchParams, setSearchParams] = useSearchParams();


    async function submitForm(e) {
        e.preventDefault()
        let data = new FormData(e.target)
        if (data.get("password") !== data.get("passwordConfirm")) {
            console.log("Claves no coinciden")
            return
        }
        let tokenPassword=searchParams.get("token")
        let resp = await actions.changePasswordRecovery(tokenPassword, data.get("password"))
        if (resp >= 400) {
            return
        }
        console.log("Clave cambiada")
    }

    return (
        <div className="text-center mt-5">
            <h1>Hello Rigo!!</h1>
            <form onSubmit={submitForm}>
                <div className="mb-3">
                    <label htmlFor="exampleInputPassword1" className="form-label">Password</label>
                    <input type="password" className="form-control" name="password" id="password" />
                </div>
                <div className="mb-3">
                    <label htmlFor="exampleInputPassword1" className="form-label">Password Confirm</label>
                    <input type="password" className="form-control" name="passwordConfirm" id="passwordConfirm" />
                </div>
                <button type="submit" className="btn btn-primary">Recovery</button>
            </form>
            <div className="alert alert-info">

            </div>
        </div>
    );
};
