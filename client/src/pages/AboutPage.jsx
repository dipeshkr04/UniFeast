import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { HiOutlineUserGroup } from 'react-icons/hi';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { MdRestaurantMenu } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import PublicNav from '../components/common/PublicNav';

const teamMembers = [
  {
    name: 'Shubh Goel',
    image: '/team/shubh.jpeg',
    linkedin: 'https://www.linkedin.com/in/shubhhgoel/',
    github: 'https://github.com/shubhgoel124',
  },
  {
    name: 'Kawyanshu Raj',
    image: '/team/kawyanshu.png',
    linkedin: 'https://www.linkedin.com/in/kawyanshuraj/',
    github: 'https://github.com/masked-byte18',
  },
  {
    name: 'Shivang Tonde',
    image: '/team/shivang.jpeg',
    linkedin: 'https://www.linkedin.com/in/shivang-tonde-56757528a/',
    github: 'https://github.com/cybercondor18',
  },
  {
    name: 'Dipesh Kumar',
    image: '/team/dipesh.jpg',
    linkedin: 'https://www.linkedin.com/in/dipesh-kumar09/',
    github: 'https://github.com/dipeshkr04',
  },
];

const buildNotes = [
  'A campus-first food ordering flow for IIIT Nagpur students.',
  'Live kitchen status, queue visibility, order history, pools, and nutrition tracking in one place.',
  'Designed to make canteen rush hours calmer for students and easier to operate for staff.',
];

function AboutContent({ isPublic }) {
  return (
    <main className={`about-page animate-fadeIn ${isPublic ? 'public-static-main' : ''}`}>
      <section className="about-hero">
        <Motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="about-hero-copy"
        >
          <p className="about-kicker">About UniFeast</p>
          <h1>Student-built campus dining.</h1>
          <p>
            UniFeast keeps menus, queues, pooled orders, and nutrition simple for IIIT Nagpur.
          </p>
          <div className="about-hero-actions">
            <Link to={isPublic ? '/register' : '/'} className="btn-primary about-primary-action">
              <MdRestaurantMenu className="w-5 h-5" />
              {isPublic ? 'Start with UniFeast' : 'Back to UniFeast'}
            </Link>
          </div>
        </Motion.div>

        <Motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="about-snapshot glass-card-static"
        >
          <div className="about-snapshot-icon gradient-primary">
            <HiOutlineUserGroup className="w-7 h-7 text-white" />
          </div>
          <div>
            <span>4</span>
            <p>student makers</p>
          </div>
          <div>
            <span>1</span>
            <p>campus dining system</p>
          </div>
        </Motion.div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <p className="about-kicker">Made By</p>
          <h2>Meet the UniFeast team</h2>
        </div>

        <div className="about-team-grid">
          {teamMembers.map((member, index) => (
            <Motion.article
              key={member.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.38, delay: index * 0.06 }}
              className="about-team-card glass-card-static"
            >
              <div className="about-team-photo">
                <img src={member.image} alt={member.name} loading="lazy" />
              </div>
              <div className="about-team-copy">
                <h3>{member.name}</h3>
                <p>UniFeast creator</p>
              </div>
              <div className="about-team-links" aria-label={`${member.name} profile links`}>
                <a href={member.linkedin} target="_blank" rel="noreferrer" className="about-social-btn about-linkedin-btn">
                  <FaLinkedin className="w-4 h-4" />
                  LinkedIn
                </a>
                <a href={member.github} target="_blank" rel="noreferrer" className="about-social-btn about-github-btn">
                  <FaGithub className="w-4 h-4" />
                  GitHub
                </a>
              </div>
            </Motion.article>
          ))}
        </div>
      </section>

      <section className="about-notes glass-card-static">
        {buildNotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </section>
    </main>
  );
}

export default function AboutPage() {
  const { user } = useAuth();
  const isPublic = !user;

  if (isPublic) {
    return (
      <div className="public-landing-page public-static-page">
        <PublicNav />
        <AboutContent isPublic />
      </div>
    );
  }

  return <AboutContent />;
}
