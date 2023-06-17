"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from datetime import timedelta
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Favorites, People, TokenBlockedList
from api.utils import generate_sitemap, APIException
from api.sendmail import sendMail, recoveryPasswordTemplate
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt, get_jti
import tempfile
from firebase_admin import storage

api = Blueprint('api', __name__)
app = Flask(__name__)
bcrypt = Bcrypt(app)


@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():

    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }

    return jsonify(response_body), 200


@api.route("/signup", methods=["POST"])
def user_create():
    data = request.get_json()
    print(data)
    new_user = User.query.filter_by(email=data["email"]).first()
    if (new_user is not None):
        return jsonify({
            "msg": "Email registrado"
        }), 400
    secure_password = bcrypt.generate_password_hash(
        data["password"], rounds=None).decode("utf-8")
    new_user = User(email=data["email"],
                    password=secure_password, is_active=True)
    db.session.add(new_user)
    db.session.commit()
    return jsonify(new_user.serialize()), 201


@api.route("/login", methods=["POST"])
def user_login():
    user_email = request.json.get("email")
    user_password = request.json.get("password")
    # Buscar al usuario por el correo
    user = User.query.filter_by(email=user_email).first()
    if user is None:
        return jsonify({"message": "User no found"}), 401

    # Verficar la clave
    if not bcrypt.check_password_hash(user.password, user_password):
        return jsonify({"message": "Wrong password"}), 401
    # Generar el token
    access_token = create_access_token(identity=user.id,)
    access_jti = get_jti(access_token)
    refresh_token = create_refresh_token(identity=user.id, additional_claims={
                                         "accessToken": access_jti})
    # Retornar el token
    return jsonify({"accessToken": access_token,
                    "refreshToken": refresh_token,
                    "userInfo": user.serialize()}
                   )


@api.route("/changepassword", methods=["POST"])
@jwt_required()
def change_password():
    new_password = request.json.get("password")
    user_id = get_jwt_identity()
    secure_password = bcrypt.generate_password_hash(
        new_password, rounds=None).decode("utf-8")
    user = User.query.get(user_id)
    user.password = secure_password
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "Clave actualizada"})


@api.route("/recoverypassword", methods=["POST"])
def recovery_password():
    user_email = request.json.get("email")
    user = User.query.filter_by(email=user_email).first()
    if user is None:
        return jsonify({"message": "User no found"}), 401
    # 1ro: Generar el token temporal para el cambio de clave
    access_token = create_access_token(
        identity=user.id, additional_claims={"type": "password"})
    # 2do: Enviar el enlace con el token via email para el cambio de clave
    if recoveryPasswordTemplate(access_token, user_email):
        return jsonify({"msg": "Correo enviado"})
    else:
        return jsonify({"msg": "Correo no enviado"}), 401


@api.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def user_refresh():
    # Identificadores de tokens viejos
    jti_refresh = get_jwt()["jti"]
    jti_access = get_jwt()["accessToken"]
    # Bloquear los tokens viejos
    accessRevoked = TokenBlockedList(jti=jti_access)
    refreshRevoked = TokenBlockedList(jti=jti_refresh)
    db.session.add(accessRevoked)
    db.session.add(refreshRevoked)
    db.session.commit()
    # Generar nuevos tokens
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    access_jti = get_jti(access_token)
    refresh_token = create_refresh_token(identity=user_id, additional_claims={
                                         "accessToken": access_jti})
    # Retornar el token
    return jsonify({"accessToken": access_token, "refreshToken": refresh_token})


@api.route("/logout", methods=["POST"])
@jwt_required()
def user_logout():
    jwt = get_jwt()["jti"]
    tokenBlocked = TokenBlockedList(jti=jwt)
    db.session.add(tokenBlocked)
    db.session.commit()
    return jsonify({"msg": "Token revoked"})


@api.route("/profilepic", methods=["POST"])
@jwt_required()
def user_profile_pic():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    # Recibir el archivo
    file = request.files["profilePic"]
    # Extraer la extension del archivo (jpg, png, etc)
    extension = file.filename.split(".")[1]
    # Guardar en un archivo temporal
    temp = tempfile.NamedTemporaryFile(delete=False)
    file.save(temp.name)
    # Cargar el archivo a firebase
    bucket = storage.bucket(name="clase-imagenes-flask.appspot.com")
    filename = "profilePics/" + str(user_id) + "." + extension
    resource = bucket.blob(filename)
    resource.upload_from_filename(temp.name, content_type="image/"+extension)
    # Agregar la imagen de perfil al usuario
    user.profile_pic = filename
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "Profile pic updated", "pictureUrl": user.get_profile_pic()})


@api.route("/helloprotected", methods=['GET'])
@jwt_required()
def hello_protected_get():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return jsonify({
        "user": user.serialize(),
        "message": "Hello protected route"
    })


@api.route("/user/<int:user_id>", methods=["GET"])
def user_get(user_id):
    user = User.query.get(user_id)
    if (user is None):
        return jsonify({"msg": "Usuario no registrado"}), 404

    return jsonify(user.serialize())

# /user/1/favorites


@api.route("/user/<int:user_id>/favorites", methods=['GET'])
def user_favorites_get(user_id):
    favorites_query = Favorites.query.filter_by(user_id=user_id).all()
    favorites_list = list(map(lambda fav: fav.serialize(), favorites_query))
    return jsonify(favorites_list)

# /favorite/1/people/3


@api.route("/favorite/<string:element>/<int:element_id>", methods=["POST"])
def favorite_planet_create(element, element_id):
    user_id = request.get_json()["userId"]
    new_favorite = Favorites(
        type=element, element_id=element_id, user_id=user_id)
    db.session.add(new_favorite)
    db.session.commit()
    return jsonify({"msg": "Favorite created"}), 201


@api.route("/favorite/<string:element>/<int:element_id>", methods=["DELETE"])
def favorite_planet_delete(element, element_id):
    user_id = request.get_json()["userId"]
    favorite = Favorites.query.filter_by(
        type=element, element_id=element_id, user_id=user_id).first()

    if (favorite is None):
        return jsonify({"msg": "Favorite not found"}), 404

    db.session.delete(favorite)
    db.session.commit()
    return jsonify({"msg": "Favorite deleted"}), 200


@api.route("/people", methods=['GET'])
def people_get():
    people = People.query.all()
    people = list(map(lambda p: p.serialize(), people))
    return jsonify(people)
