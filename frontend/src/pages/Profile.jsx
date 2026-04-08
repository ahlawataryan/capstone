import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import {
  getActiveSkills,
  getProfileSkills,
  saveProfileSkills,
} from "../services/skillService";
import { 
    getUserByEmail, 
    updateUser, 
    updateUserProfile, 
    updateIcon, 
    getIcon, 
    setUserIcon,
    deleteIcon 
} from "../services/supabaseapi"


const BIO_MAX = 1024;

function formatPhone(digits) {
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function Profile() {
  const { user } = useAuth0();
  const [allSkills, setAllSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
  });

  const handleSkillToggle = (skillId) => {
  setSelectedSkills((prev) =>
    prev.includes(skillId)
      ? prev.filter((id) => id !== skillId)
      : [...prev, skillId]
  );
};

  const [previewUrl, setPreviewUrl] = useState("");
  const [iconFile, setIconFile] = useState("");//Added to track the profile picture
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
  const loadProfile = async () => {
    if (!user?.email) return;

    try {
      const { data: profileData, error } = await getUserByEmail(user.email);
      if (error) throw error;
      setProfile(profileData);

      const skillsData = await getActiveSkills();
      setAllSkills(skillsData);

      if (profileData) {
        setForm({
          name: `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim(),
          email: profileData.email || user.email || "",
          phone: profileData.phone || "",
          bio: profileData.bio || "",
        });

        const userSkillIds = await getProfileSkills(profileData.user_id);
        setSelectedSkills(userSkillIds);
      } else {
        setForm({
          name: user.name || "",
          email: user.email || "",
          phone: "",
          bio: "",
        });
      }
      if(profileData.icon_url != null || profileData.icon_url == ""){
        const {data: iconData} = getIcon(profileData.icon_url);//icon_url is null by default
        setPreviewUrl(iconData.publicUrl || "");
      }
      else {
        setPreviewUrl("");
      }
    } catch (err) {
      console.error(err);
      setError("Could not load profile.");
    }
  };

  loadProfile();
}, [user]);

  const handleChange = (e) => {
    setError("");
    setSuccess("");

    const { name, value } = e.target;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: digitsOnly }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    setError("");
    setSuccess("");

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    //Tracking the current profile picture. I don't think the data is correct
    setIconFile(file);
    //New image saved in PreviewUrl. Add this to database in save section
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!user?.email) {
      setError("No authenticated user found.");
      return;
    }

    if (form.phone && form.phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    try {
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      let updatedProfile;

try {
  console.log("Calling updateUserProfile...");
  const { data, error: updateError } = await updateUserProfile(profile.user_id, {
    first_name: firstName,
    last_name: lastName,
    phone: form.phone,
    bio: form.bio,
  });

  if (updateError) throw updateError;

  updatedProfile = data;

  if (!updatedProfile) {
    setError("Could not save profile changes.");
    return;
  }

  console.log("updatedProfile:", updatedProfile);
  //Update profile picture
  //Checking if there is a new image. icon_url is null by default
  let userUrl = profile.user_id + ".jpg";
  if(profile.icon_url != previewUrl){
    const {error : updateIconError} = updateIcon(userUrl, iconFile);
    if(updateIconError) throw updateIconError;
    const {error : setUserIconError} = setUserIcon(profile.email, userUrl);
    if(setUserIconError) throw setUserIconError;
  }
} catch (err) {
  console.error("updateUserProfile failed:", err);
  setError("updateUserProfile failed.");
  return;
}

      if (!updatedProfile) {
        setError("Could not save profile changes.");
        return;
      }

      try {
        console.log("Saving skills with id:", updatedProfile.user_id);
        console.log("selectedSkills:", selectedSkills);

        console.log("updatedProfile:", updatedProfile);
        console.log("user_id:", updatedProfile.user_id);

        await saveProfileSkills(updatedProfile.user_id, selectedSkills);
        console.log("saveProfileSkills worked");
      } catch (err) {
        console.error("saveProfileSkills failed:", err);
        setError("saveProfileSkills failed.");
        return;
      }

      setProfile(updatedProfile);
      setSuccess("Profile changes saved successfully.");
    } catch (err) {
      console.error("Outer catch:", err);
      setError("Could not save profile changes.");
    }
  };

  

  return (
    <>
      <Navbar />

      <div className="container py-4">
        <h2 className="mb-4">
          My Profile ({profile?.role || "Loading..."})
        </h2>

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-body text-center">
                <img
                  src={previewUrl || "https://placehold.co/140x140"}
                  alt="Profile"
                  className="rounded-circle mb-3"
                  width="140"
                  height="140"
                  style={{ objectFit: "cover" }}
                />

                <div className="mb-3 text-start">
                  <label className="form-label fw-semibold">
                    Upload Profile Photo
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <div className="form-text">PNG or JPG, max 5MB.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title mb-3">Skills</h5>

                <div className="d-flex flex-wrap gap-2">
                  {allSkills.map((skill) => {
                    const isSelected = selectedSkills.includes(skill.skill_id);

                    return (
                      <button
                        key={skill.skill_id}
                        type="button"
                        className={`btn ${
                          isSelected ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => handleSkillToggle(skill.skill_id)}
                      >
                        {skill.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>


          <div className="col-lg-20">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title mb-3">Edit Profile Details</h5>

                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <form onSubmit={handleSave}>
                  <div className="row g-20">
                    <div className="col-md-6">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        value={form.name}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        value={form.email}
                        disabled
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        name="phone"
                        className="form-control"
                        placeholder="(414) 555-0123"
                        value={formatPhone(form.phone)}
                        onChange={handleChange}
                        maxLength={14}
                      />
                      <div className="form-text">10-digit US phone number</div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Bio</label>
                      <textarea
                        name="bio"
                        className="form-control"
                        rows="4"
                        placeholder="Tell us about yourself"
                        value={form.bio}
                        onChange={handleChange}
                        maxLength={BIO_MAX}
                      />
                      <div className={`form-text text-end ${form.bio.length >= BIO_MAX ? "text-danger" : ""}`}>
                        {form.bio.length} / {BIO_MAX} characters
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Skills</label>
                      <div className="d-flex flex-wrap gap-2">
                        {/* {allSkills.map((skill) => {
                          const isSelected = selectedSkills.includes(skill.skill_id);

                          return (
                            <button
                              key={skill.skill_id}
                              type="button"
                              className={`btn ${isSelected ? "btn-primary" : "btn-outline-primary"}`}
                              onClick={() => handleSkillToggle(skill.skill_id)}
                            >
                              {skill.name}
                            </button>
                          );
                        })} */}
                      </div>
                    </div>

                    <div className="col-12 mt-2">
                      <button type="submit" className="btn btn-primary px-4">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}